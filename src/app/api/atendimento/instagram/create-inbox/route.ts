import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { observeChannelEntitlement } from '@/lib/authorization/channel-observation'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

type ChatwootAccountData = {
  chatwootAccountId?: number | string
  chatwootUrl?: string
}

type ChatwootInboxResponse = {
  id?: number
  channel_id?: number
  name?: string
}

class InstagramInboxError extends Error {
  status: number
  code: string
  constructor(message: string, status = 500, code = 'INSTAGRAM_INBOX_ERROR') {
    super(message)
    this.name = 'InstagramInboxError'
    this.status = status
    this.code = code
  }
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeBaseUrl(url?: string | null) {
  return url?.trim().replace(/\/$/, '') || null
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return null
  const num = Number(value)
  if (!Number.isSafeInteger(num) || num <= 0) return null
  return num
}

function parseChatwootAccountData(raw: string): ChatwootAccountData | null {
  try {
    const parsed = JSON.parse(raw) as ChatwootAccountData
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function readInstagramSettings(rawSettings: Record<string, unknown>) {
  return rawSettings.atendimentoInstagram &&
    typeof rawSettings.atendimentoInstagram === 'object'
    ? (rawSettings.atendimentoInstagram as Record<string, unknown>)
    : {}
}

async function chatwootRequest<T>(params: {
  url: string
  apiToken: string
  method: 'POST' | 'PATCH'
  body: Record<string, unknown>
}): Promise<T> {
  const response = await fetch(params.url, {
    method: params.method,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: params.apiToken,
    },
    body: JSON.stringify(params.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })

  const text = await response.text().catch(() => '')
  const json = text
    ? safeJsonParse<T & { error?: string; message?: string }>(text)
    : null

  if (!response.ok) {
    throw new InstagramInboxError(
      'Falha ao criar inbox API do Instagram no Atendimento.',
      502,
      'CHATWOOT_INSTAGRAM_INBOX_REQUEST_FAILED'
    )
  }

  if (json) return json as T

  throw new InstagramInboxError(
    'Resposta inválida do Atendimento ao criar inbox API do Instagram.',
    502,
    'INVALID_CHATWOOT_RESPONSE'
  )
}

function buildCreatePayload(params: {
  inboxName: string
  webhookUrl: string
}) {
  return {
    name: params.inboxName,
    channel: {
      type: 'api',
      webhook_url: params.webhookUrl,
    },
  }
}

export async function POST() {
  const perm = await checkPermission('integrations', 'edit')

  if (!perm.allowed || !perm.session) {
    return (
      perm.errorResponse ??
      NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    )
  }

  const organizationId = perm.session.user.organizationId
  await observeChannelEntitlement(organizationId, 'instagram_channel')

  const [organization, chatwootAccount] = await Promise.all([
    prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        settings: true,
        chatwootAccountId: true,
        chatwootUrl: true,
        updatedAt: true,
      },
    }),
    prisma.connectedAccount.findUnique({
      where: {
        provider_organizationId: {
          provider: 'chatwoot',
          organizationId,
        },
      },
      select: {
        id: true,
        isActive: true,
        accessTokenEnc: true,
        data: true,
      },
    }),
  ])

  if (!organization) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      { status: 404 }
    )
  }

  const parsedSettings =
    safeJsonParse<Record<string, unknown>>(organization.settings) ?? {}

  const currentInstagram = readInstagramSettings(parsedSettings)
  let remoteCreateAttempted = false

  try {
    const inboxName =
      typeof currentInstagram.inboxName === 'string' &&
      currentInstagram.inboxName.trim()
        ? currentInstagram.inboxName.trim()
        : 'Instagram Direct'

    const instagramBusinessId =
      typeof currentInstagram.instagramBusinessId === 'string'
        ? currentInstagram.instagramBusinessId.trim()
        : ''

    const instagramHandle =
      typeof currentInstagram.instagramHandle === 'string'
        ? currentInstagram.instagramHandle.trim()
        : ''

    // Provisioning an inbox must not turn an unverified manual configuration into a connected Meta account.
    if (currentInstagram.status !== 'connected' ||
        typeof currentInstagram.facebookPageId !== 'string' ||
        !currentInstagram.facebookPageId.trim() ||
        typeof currentInstagram.metaAccessTokenEncrypted !== 'string' ||
        !currentInstagram.metaAccessTokenEncrypted.trim() ||
        typeof currentInstagram.facebookPageAccessTokenEncrypted !== 'string' ||
        !currentInstagram.facebookPageAccessTokenEncrypted.trim()) {
      throw new InstagramInboxError(
        'Selecione e valide a conta Instagram pela Meta antes de criar a inbox.',
        409,
        'INSTAGRAM_META_CONNECTION_REQUIRED'
      )
    }

    if (!instagramBusinessId) {
      throw new InstagramInboxError(
        'Instagram Business ID não encontrado. Selecione a conta Instagram antes de criar a inbox.',
        400,
        'INSTAGRAM_BUSINESS_ID_MISSING'
      )
    }

    if (!chatwootAccount?.isActive) {
      throw new InstagramInboxError(
        'Integração do Atendimento não está ativa para esta organização.',
        409,
        'CHATWOOT_NOT_CONNECTED'
      )
    }

    if (!chatwootAccount.accessTokenEnc?.trim()) {
      throw new InstagramInboxError(
        'Token da integração do Atendimento não encontrado.',
        409,
        'CHATWOOT_API_TOKEN_MISSING'
      )
    }

    const chatwootData = parseChatwootAccountData(chatwootAccount.data)

    if (!chatwootData) {
      throw new InstagramInboxError(
        'Payload da integração do Atendimento está inválido.',
        409,
        'INVALID_CHATWOOT_CONNECTED_ACCOUNT'
      )
    }

    const connectedAccountId = toPositiveInt(chatwootData.chatwootAccountId)

    if (!connectedAccountId) {
      throw new InstagramInboxError(
        'chatwootAccountId não encontrado na integração do Atendimento.',
        409,
        'CHATWOOT_ACCOUNT_ID_MISSING'
      )
    }

    const organizationAccountId = toPositiveInt(organization.chatwootAccountId)

    if (organizationAccountId && organizationAccountId !== connectedAccountId) {
      throw new InstagramInboxError(
        'Conta do Atendimento inconsistente entre organização e integração.',
        409,
        'CHATWOOT_ACCOUNT_MISMATCH'
      )
    }

    const apiToken = decryptToken(chatwootAccount.accessTokenEnc)

    const apiBaseUrl =
      normalizeBaseUrl(process.env.CHATWOOT_INTERNAL_URL) ||
      normalizeBaseUrl(organization.chatwootUrl) ||
      normalizeBaseUrl(chatwootData.chatwootUrl)

    if (!apiBaseUrl) {
      throw new InstagramInboxError(
        'Base URL do Atendimento não configurada.',
        409,
        'CHATWOOT_BASE_URL_MISSING'
      )
    }

    const publicBaseUrl = normalizeBaseUrl(process.env.NEXTAUTH_URL)

    if (!publicBaseUrl) {
      throw new InstagramInboxError(
        'NEXTAUTH_URL não configurada.',
        409,
        'NEXTAUTH_URL_MISSING'
      )
    }

    const webhookUrl = `${publicBaseUrl}/api/atendimento/instagram/webhook`

    const rawExistingInboxId = currentInstagram.chatwootInboxId
    const existingInboxId = toPositiveInt(rawExistingInboxId)

    // A malformed stored reference is not evidence that no remote inbox exists.
    // Refuse a blind POST; an operator must reconcile the existing Chatwoot inbox.
    if (rawExistingInboxId !== undefined && rawExistingInboxId !== null &&
        rawExistingInboxId !== '' && !existingInboxId) {
      throw new InstagramInboxError(
        'Referência da inbox inválida. Verifique a inbox no Atendimento antes de criar outra.',
        409,
        'CHATWOOT_INBOX_ID_INVALID'
      )
    }

    // An existing inbox must never be patched through a different Chatwoot account.
    if (existingInboxId && currentInstagram.chatwootAccountId != null &&
        toPositiveInt(currentInstagram.chatwootAccountId) !== connectedAccountId) {
      throw new InstagramInboxError(
        'A inbox existente pertence a outra conta do Atendimento. Reconcilie a integração antes de continuar.',
        409,
        'CHATWOOT_INBOX_ACCOUNT_MISMATCH'
      )
    }

    // A previous remote POST may have succeeded even when its response or local
    // persistence failed. Never issue another POST until reconciled.
    if (!existingInboxId && currentInstagram.inboxProvisionStatus === 'reconciliation_required') {
      throw new InstagramInboxError(
        'Provisionamento anterior sem confirmação. Reconcilie a inbox no Atendimento antes de tentar novamente.',
        409,
        'CHATWOOT_INBOX_RECONCILIATION_REQUIRED'
      )
    }

    let inboxResponse: ChatwootInboxResponse
    let action: 'created' | 'updated'

    if (existingInboxId) {
      inboxResponse = await chatwootRequest<ChatwootInboxResponse>({
        url: `${apiBaseUrl}/api/v1/accounts/${connectedAccountId}/inboxes/${existingInboxId}`,
        apiToken,
        method: 'PATCH',
        body: {
          name: inboxName,
        },
      })

      action = 'updated'
    } else {
      remoteCreateAttempted = true
      inboxResponse = await chatwootRequest<ChatwootInboxResponse>({
        url: `${apiBaseUrl}/api/v1/accounts/${connectedAccountId}/inboxes`,
        apiToken,
        method: 'POST',
        body: buildCreatePayload({
          inboxName,
          webhookUrl,
        }),
      })

      action = 'created'
    }

    const inboxId = toPositiveInt(inboxResponse.id)

    if (!inboxId) {
      throw new InstagramInboxError(
        'Resposta do Atendimento sem inbox id.',
        502,
        'CHATWOOT_INBOX_ID_MISSING'
      )
    }

    // A PATCH response must refer to the exact inbox requested; never persist
    // a different remote identifier as the tenant's existing inbox.
    if (existingInboxId && inboxId !== existingInboxId) {
      throw new InstagramInboxError(
        'Resposta do Atendimento inconsistente com a inbox solicitada.',
        502,
        'CHATWOOT_INBOX_RESPONSE_MISMATCH'
      )
    }

    const rawChannelId = inboxResponse.channel_id
    const channelId = toPositiveInt(rawChannelId)
    if (rawChannelId !== undefined && rawChannelId !== null && !channelId) {
      throw new InstagramInboxError(
        'Resposta do Atendimento com identificador de canal inválido.',
        502,
        'CHATWOOT_CHANNEL_ID_INVALID'
      )
    }
    const nowIso = new Date().toISOString()

    const nextSettings = {
      ...parsedSettings,
      atendimentoInstagram: {
        ...currentInstagram,
        enabled: true,
        status: 'connected',
        inboxName,
        instagramBusinessId,
        instagramHandle,
        chatwootInboxId: inboxId,
        chatwootChannelId: channelId,
        chatwootAccountId: connectedAccountId,
        webhookUrl,
        inboxProvisionStatus: 'created',
        inboxProvisionedAt:
          action === 'created'
            ? nowIso
            : typeof currentInstagram.inboxProvisionedAt === 'string'
              ? currentInstagram.inboxProvisionedAt
              : nowIso,
        lastInboxSyncAt: nowIso,
        lastInboxError: null,
        updatedAt: nowIso,
      },
    }

    // Never overwrite a concurrent settings change or write to a deleted tenant.
    const saved = await prisma.organization.updateMany({
      where: { id: organizationId, deletedAt: null, settings: organization.settings },
      data: { settings: JSON.stringify(nextSettings) },
    })
    if (saved.count !== 1) {
      // The remote operation may have succeeded. The concurrent writer owns the
      // current settings; do not overwrite it with a stale reconciliation flag.
      throw new InstagramInboxError(
        'Configuração alterada durante o provisionamento. Verifique a inbox antes de tentar novamente.',
        409,
        'CHATWOOT_INBOX_SETTINGS_CONFLICT'
      )
    }
    const updatedOrganization = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, name: true, slug: true, plan: true, updatedAt: true },
    })
    if (!updatedOrganization) {
      return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      action,
      orgScope: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        slug: updatedOrganization.slug,
        plan: updatedOrganization.plan,
      },
      inbox: {
        chatwootInboxId: inboxId,
        chatwootChannelId: channelId,
        chatwootAccountId: connectedAccountId,
        inboxName,
        webhookUrl,
      },
      instagram: {
        instagramBusinessId,
        instagramHandle,
      },
      savedAt: updatedOrganization.updatedAt.toISOString(),
    })
  } catch (error) {
    const message =
      error instanceof InstagramInboxError
        ? error.message
        : 'Erro inesperado ao criar inbox API do Instagram.'

    const nowIso = new Date().toISOString()

    // Error reporting must not overwrite a successful or newer configuration.
    await prisma.organization.updateMany({
      where: { id: organizationId, deletedAt: null, settings: organization.settings },
      data: {
        settings: JSON.stringify({
          ...parsedSettings,
          atendimentoInstagram: {
            ...currentInstagram,
            inboxProvisionStatus:
              remoteCreateAttempted || currentInstagram.inboxProvisionStatus === 'reconciliation_required'
                ? 'reconciliation_required'
                : 'error',
            lastInboxError: message,
            lastInboxSyncAt: nowIso,
            updatedAt: nowIso,
          },
        }),
      },
    })

    if (error instanceof InstagramInboxError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        error: 'INSTAGRAM_INBOX_CREATE_FAILED',
        message,
      },
      { status: 500 }
    )
  }
}