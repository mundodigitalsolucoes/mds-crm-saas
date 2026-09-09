import {
  chatwootApi,
  getChatwootCredentials,
  listChatwootInboxes,
} from '@/lib/chatwoot'

const EMAIL_CHANNEL_TYPE = 'Channel::Email'

type AtendimentoEmailInbox = {
  id: number
  name: string
  channel_type?: string
  email?: string
  imap_enabled?: boolean
  smtp_enabled?: boolean
  provider?: string
  reauthorization_required?: boolean
}

export type EmailChannelSummary = {
  id: number
  name: string
  email: string
  status: 'connected' | 'attention'
  inboundReady: boolean
  outboundReady: boolean
  authMode: 'google' | 'password'
  reauthorizationRequired: boolean
}

function requireCredentials<T>(value: T | null): T {
  if (!value) {
    throw new Error('Atendimento não configurado para esta organização.')
  }

  return value
}

function toEmailSummary(inbox: AtendimentoEmailInbox): EmailChannelSummary {
  const authMode = inbox.provider === 'google' ? 'google' : 'password'
  const reauthorizationRequired =
    authMode !== 'google' || inbox.reauthorization_required === true
  const inboundReady =
    inbox.imap_enabled === true && !reauthorizationRequired
  const outboundReady =
    (authMode === 'google' || inbox.smtp_enabled === true) &&
    !reauthorizationRequired

  return {
    id: inbox.id,
    name: inbox.name,
    email: inbox.email ?? '',
    status: inboundReady && outboundReady ? 'connected' : 'attention',
    inboundReady,
    outboundReady,
    authMode,
    reauthorizationRequired,
  }
}

export async function getGoogleEmailAuthorizationUrl(
  organizationId: string
): Promise<string> {
  const credentials = requireCredentials(
    await getChatwootCredentials(organizationId)
  )
  const response = await chatwootApi<{ success?: boolean; url?: string }>(
    credentials,
    '/google/authorization',
    { method: 'POST', body: {}, timeoutMs: 10_000 }
  )

  if (!response.success || !response.url) {
    throw new Error('A conexão com o Google ainda não está configurada.')
  }

  const authorizationUrl = new URL(response.url)
  if (
    authorizationUrl.protocol !== 'https:' ||
    authorizationUrl.hostname !== 'accounts.google.com' ||
    !authorizationUrl.searchParams.get('client_id')
  ) {
    throw new Error('A conexão com o Google ainda não está configurada.')
  }

  return authorizationUrl.toString()
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
