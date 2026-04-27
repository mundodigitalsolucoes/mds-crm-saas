import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
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
  detail?: string

  constructor(message: string, status = 500, code = 'INSTAGRAM_INBOX_ERROR', detail?: string) {
    super(message)
    this.name = 'InstagramInboxError'
    this.status = status
    this.code = code
    this.detail = detail
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
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
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
    const detail =
      (json &&
      typeof json === 'object' &&
      ('error' in json || 'message' in json)
        ? String(
            (json as { error?: string; message?: string }).error ||
              (json as { message?: string }).message ||
              ''
          )
        : '') ||
      text ||
      `chatwoot_http_${response.status}`

    throw new InstagramInboxError(
      'Falha ao criar inbox API do Instagram no Atendimento.',
      response.status,
      'CHATWOOT_INSTAGRAM_INBOX_REQUEST_FAILED',
      detail
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

  const [organization, chatwootAccount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
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

    const existingInboxId = toPositiveInt(currentInstagram.chatwootInboxId)

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

    const channelId = toPositiveInt(inboxResponse.channel_id)
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

    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: JSON.stringify(nextSettings),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        updatedAt: true,
      },
    })

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

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: JSON.stringify({
          ...parsedSettings,
          atendimentoInstagram: {
            ...currentInstagram,
            inboxProvisionStatus: 'error',
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
          detail: error.detail || null,
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