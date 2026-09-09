import {
  chatwootApi,
  getChatwootCredentials,
  listChatwootInboxes,
} from '@/lib/chatwoot'

const EMAIL_CHANNEL_TYPE = 'Channel::Email'
const GOOGLE_IMAP_ADDRESS = 'imap.gmail.com'
const GOOGLE_IMAP_PORT = 993
const GOOGLE_SMTP_ADDRESS = 'smtp.gmail.com'
const GOOGLE_SMTP_PORT = 587

type AtendimentoEmailInbox = {
  id: number
  name: string
  channel_type?: string
  email?: string
  imap_enabled?: boolean
  smtp_enabled?: boolean
}

export type EmailChannelSummary = {
  id: number
  name: string
  email: string
  status: 'connected' | 'attention'
  inboundReady: boolean
  outboundReady: boolean
}

type ConnectGoogleWorkspaceEmailInput = {
  organizationId: string
  name: string
  email: string
  appPassword: string
}

function requireCredentials<T>(value: T | null): T {
  if (!value) {
    throw new Error('Atendimento não configurado para esta organização.')
  }

  return value
}

function toEmailSummary(inbox: AtendimentoEmailInbox): EmailChannelSummary {
  const inboundReady = inbox.imap_enabled === true
  const outboundReady = inbox.smtp_enabled === true

  return {
    id: inbox.id,
    name: inbox.name,
    email: inbox.email ?? '',
    status: inboundReady && outboundReady ? 'connected' : 'attention',
    inboundReady,
    outboundReady,
  }
}

export async function listEmailChannels(
  organizationId: string
): Promise<EmailChannelSummary[]> {
  const credentials = requireCredentials(
    await getChatwootCredentials(organizationId)
  )
  const inboxes = await listChatwootInboxes(credentials)

  return (inboxes as AtendimentoEmailInbox[])
    .filter((inbox) => inbox.channel_type === EMAIL_CHANNEL_TYPE)
    .map(toEmailSummary)
}

export async function connectGoogleWorkspaceEmail(
  input: ConnectGoogleWorkspaceEmailInput
): Promise<EmailChannelSummary> {
  const credentials = requireCredentials(
    await getChatwootCredentials(input.organizationId)
  )
  const normalizedEmail = input.email.trim().toLowerCase()
  const appPassword = input.appPassword.replace(/\s+/g, '')
  const smtpDomain = normalizedEmail.split('@')[1]

  const existingInboxes = await listChatwootInboxes(credentials)
  const duplicated = (existingInboxes as AtendimentoEmailInbox[]).find(
    (inbox) =>
      inbox.channel_type === EMAIL_CHANNEL_TYPE &&
      inbox.email?.trim().toLowerCase() === normalizedEmail
  )

  if (duplicated) {
    throw new Error('Este e-mail já possui um canal nesta organização.')
  }

  // A atualização posterior de um canal de e-mail faz o Atendimento abrir
  // conexões IMAP e SMTP durante a própria requisição. Em redes onde a saída
  // para 993/587 está bloqueada ou lenta, o proxy encerra a resposta antes do
  // backend. Criar o canal já configurado é suportado pela mesma API e evita
  // manter a requisição do CRM presa nessa validação síncrona.
  const inbox = await chatwootApi<AtendimentoEmailInbox>(
    credentials,
    '/inboxes',
    {
      method: 'POST',
      timeoutMs: 20_000,
      body: {
        name: input.name,
        enable_auto_assignment: true,
        timezone: 'America/Sao_Paulo',
        channel: {
          type: 'email',
          email: normalizedEmail,
          imap_enabled: true,
          imap_address: GOOGLE_IMAP_ADDRESS,
          imap_port: GOOGLE_IMAP_PORT,
          imap_login: normalizedEmail,
          imap_password: appPassword,
          imap_enable_ssl: true,
          smtp_enabled: true,
          smtp_address: GOOGLE_SMTP_ADDRESS,
          smtp_port: GOOGLE_SMTP_PORT,
          smtp_login: normalizedEmail,
          smtp_password: appPassword,
          smtp_domain: smtpDomain,
          smtp_enable_starttls_auto: true,
          smtp_enable_ssl_tls: false,
          smtp_openssl_verify_mode: 'peer',
          smtp_authentication: 'login',
        },
      },
    }
  )

  if (!inbox?.id) {
    throw new Error('Atendimento não retornou o ID do canal de e-mail.')
  }

  return toEmailSummary(inbox)
}

export async function deleteEmailChannel(input: {
  organizationId: string
  inboxId: number
}): Promise<void> {
  const credentials = requireCredentials(
    await getChatwootCredentials(input.organizationId)
  )
  const inboxes = await listChatwootInboxes(credentials)
  const target = inboxes.find((inbox) => inbox.id === input.inboxId)

  if (!target || target.channel_type !== EMAIL_CHANNEL_TYPE) {
    throw new Error('Canal de e-mail não encontrado nesta organização.')
  }

  await chatwootApi(credentials, `/inboxes/${input.inboxId}`, {
    method: 'DELETE',
    timeoutMs: 10_000,
  })
}
