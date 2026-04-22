import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

type ChatwootAccountData = {
  chatwootAccountId?: number | string
  chatwootUrl?: string
  chatwootUserId?: number | string
}

type WidgetRuntimeData = {
  chatwootInboxId?: number | string | null
  chatwootChannelId?: number | string | null
  websiteToken?: string
  webWidgetScript?: string
  provisionStatus?: string
  provisionedAt?: string
  lastSyncAt?: string
  lastError?: string | null
  principalAgentLinkedAt?: string
  principalAgentUserId?: number | string | null
}

type InboxAgentsResponse = {
  payload?: Array<{
    id?: number
    email?: string
    name?: string
  }>
}

class WidgetAgentsError extends Error {
  status: number
  code?: string
  detail?: string

  constructor(message: string, status = 500, code?: string, detail?: string) {
    super(message)
    this.name = 'WidgetAgentsError'
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

function readRuntimeScalar(
  raw: Record<string, unknown> | null,
  key: string
): string | number | null {
  const value = raw?.[key]

  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return null
}

function resolveWidgetRuntime(
  rawSettings: Record<string, unknown> | null
): WidgetRuntimeData {
  const runtimeRaw =
    rawSettings && typeof rawSettings.atendimentoWidgetRuntime === 'object'
      ? (rawSettings.atendimentoWidgetRuntime as Record<string, unknown>)
      : null

  return {
    chatwootInboxId: readRuntimeScalar(runtimeRaw, 'chatwootInboxId'),
    chatwootChannelId: readRuntimeScalar(runtimeRaw, 'chatwootChannelId'),
    websiteToken:
      typeof runtimeRaw?.websiteToken === 'string' ? runtimeRaw.websiteToken : '',
    webWidgetScript:
      typeof runtimeRaw?.webWidgetScript === 'string'
        ? runtimeRaw.webWidgetScript
        : '',
    provisionStatus:
      typeof runtimeRaw?.provisionStatus === 'string'
        ? runtimeRaw.provisionStatus
        : 'draft',
    provisionedAt:
      typeof runtimeRaw?.provisionedAt === 'string'
        ? runtimeRaw.provisionedAt
        : '',
    lastSyncAt:
      typeof runtimeRaw?.lastSyncAt === 'string' ? runtimeRaw.lastSyncAt : '',
    lastError:
      typeof runtimeRaw?.lastError === 'string' ? runtimeRaw.lastError : null,
    principalAgentLinkedAt:
      typeof runtimeRaw?.principalAgentLinkedAt === 'string'
        ? runtimeRaw.principalAgentLinkedAt
        : '',
    principalAgentUserId: readRuntimeScalar(runtimeRaw, 'principalAgentUserId'),
  }
}

async function chatwootRequest<T>(params: {
  url: string
  apiToken: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
}): Promise<T> {
  const response = await fetch(params.url, {
    method: params.method,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: params.apiToken,
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
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
              (json as { error?: string; message?: string }).message ||
              ''
          )
        : '') ||
      text ||
      `chatwoot_http_${response.status}`

    throw new WidgetAgentsError(
      'Falha ao vincular agente na inbox website.',
      response.status,
      'CHATWOOT_INBOX_AGENT_REQUEST_FAILED',
      detail
    )
  }

  if (json) return json as T

  throw new WidgetAgentsError(
    'Resposta inválida do Atendimento ao vincular agente.',
    502,
    'INVALID_CHATWOOT_AGENT_RESPONSE'
  )
}

async function persistRuntimeError(params: {
  organizationId: string
  parsedSettings: Record<string, unknown>
  runtime: WidgetRuntimeData
  message: string
}) {
  try {
    const nextSettings = {
      ...params.parsedSettings,
      atendimentoWidgetRuntime: {
        ...params.runtime,
        provisionStatus: 'error',
        lastError: params.message,
        lastSyncAt: new Date().toISOString(),
      },
    }

    await prisma.organization.update({
      where: { id: params.organizationId },
      data: {
        settings: JSON.stringify(nextSettings),
      },
    })
  } catch {
    // noop
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
    return NextResponse.json({ error: 'organization_not_found' }, { status: 404 })
  }

  const parsedSettings =
    safeJsonParse<Record<string, unknown>>(organization.settings) ?? {}

  const runtime = resolveWidgetRuntime(parsedSettings)

  try {
    if (!chatwootAccount?.isActive) {
      throw new WidgetAgentsError(
        'Integração do Atendimento não está ativa para esta organização.',
        409,
        'CHATWOOT_NOT_CONNECTED'
      )
    }

    if (!chatwootAccount.accessTokenEnc?.trim()) {
      throw new WidgetAgentsError(
        'Token da integração do Atendimento não encontrado.',
        409,
        'CHATWOOT_API_TOKEN_MISSING'
      )
    }

    const chatwootData = parseChatwootAccountData(chatwootAccount.data)
    if (!chatwootData) {
      throw new WidgetAgentsError(
        'Payload da integração do Atendimento está inválido.',
        409,
        'INVALID_CHATWOOT_CONNECTED_ACCOUNT'
      )
    }

    const connectedAccountId = toPositiveInt(chatwootData.chatwootAccountId)
    if (!connectedAccountId) {
      throw new WidgetAgentsError(
        'chatwootAccountId não encontrado na integração do Atendimento.',
        409,
        'CHATWOOT_ACCOUNT_ID_MISSING'
      )
    }

    const principalChatwootUserId = toPositiveInt(chatwootData.chatwootUserId)
    if (!principalChatwootUserId) {
      throw new WidgetAgentsError(
        'chatwootUserId do agente principal não encontrado.',
        409,
        'CHATWOOT_PRINCIPAL_USER_ID_MISSING'
      )
    }

    const inboxId = toPositiveInt(runtime.chatwootInboxId)
    if (!inboxId) {
      throw new WidgetAgentsError(
        'Inbox website ainda não provisionada.',
        409,
        'WIDGET_INBOX_NOT_PROVISIONED'
      )
    }

    const organizationAccountId = toPositiveInt(organization.chatwootAccountId)
    if (organizationAccountId && organizationAccountId !== connectedAccountId) {
      throw new WidgetAgentsError(
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
      throw new WidgetAgentsError(
        'Base URL do Atendimento não configurada.',
        409,
        'CHATWOOT_BASE_URL_MISSING'
      )
    }

    const existingAgents = await chatwootRequest<InboxAgentsResponse>({
      url: `${apiBaseUrl}/api/v1/accounts/${connectedAccountId}/inbox_members/${inboxId}`,
      apiToken,
      method: 'GET',
    })

    const alreadyLinked = Array.isArray(existingAgents.payload)
      ? existingAgents.payload.some(
          (agent) => toPositiveInt(agent.id) === principalChatwootUserId
        )
      : false

    if (!alreadyLinked) {
      await chatwootRequest<InboxAgentsResponse>({
        url: `${apiBaseUrl}/api/v1/accounts/${connectedAccountId}/inbox_members`,
        apiToken,
        method: 'POST',
        body: {
          inbox_id: inboxId,
          user_ids: [principalChatwootUserId],
        },
      })
    }

    const nowIso = new Date().toISOString()

    const nextSettings = {
      ...parsedSettings,
      atendimentoWidgetRuntime: {
        ...runtime,
        provisionStatus: 'ready',
        principalAgentLinkedAt: nowIso,
        principalAgentUserId: principalChatwootUserId,
        lastError: null,
        lastSyncAt: nowIso,
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
      alreadyLinked,
      orgScope: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        slug: updatedOrganization.slug,
        plan: updatedOrganization.plan,
      },
      principalAgent: {
        chatwootUserId: principalChatwootUserId,
      },
      runtime: {
        provisionStatus: 'ready',
        principalAgentLinkedAt: nowIso,
        lastSyncAt: nowIso,
      },
      savedAt: updatedOrganization.updatedAt.toISOString(),
    })
  } catch (error) {
    const message =
      error instanceof WidgetAgentsError
        ? error.message
        : 'Erro inesperado ao vincular agente principal do widget.'

    await persistRuntimeError({
      organizationId,
      parsedSettings,
      runtime,
      message,
    })

    if (error instanceof WidgetAgentsError) {
      return NextResponse.json(
        {
          error: error.code || 'WIDGET_AGENT_LINK_FAILED',
          message: error.message,
          detail: error.detail || null,
        },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        error: 'WIDGET_AGENT_LINK_FAILED',
        message,
      },
      { status: 500 }
    )
  }
}