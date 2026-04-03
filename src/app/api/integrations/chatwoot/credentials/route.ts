// src/app/api/integrations/chatwoot/credentials/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

type ChatwootAccountData = {
  chatwootAccountId?: number | string
  chatwootUrl?: string
  ownerEmail?: string
  ownerPasswordEnc?: string
  chatwootUserId?: number | string
}

type SessionUserLike = {
  id?: string
  email?: string | null
}

type ChatwootSsoResponse = {
  url?: string
}

function normalizeBaseUrl(url?: string | null) {
  return url?.trim().replace(/\/$/, '') || null
}

function parseAccountData(raw: string): ChatwootAccountData | null {
  try {
    const parsed = JSON.parse(raw) as ChatwootAccountData
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function toPositiveInt(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
  return num
}

function buildNoStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  }
}

async function confirmChatwootUser(baseUrl: string, email: string) {
  const secret = process.env.CHATWOOT_SUPER_ADMIN_TOKEN

  if (!secret || !email) return

  try {
    await fetch(
      `${baseUrl}/sso/confirm-user?email=${encodeURIComponent(email)}&secret=${encodeURIComponent(secret)}`,
      {
        signal: AbortSignal.timeout(5_000),
        cache: 'no-store',
      }
    )
  } catch {
    // Não bloqueia o boot do atendimento
  }
}

async function getChatwootSsoUrl(baseUrl: string, chatwootUserId: number) {
  const platformToken = process.env.CHATWOOT_PLATFORM_TOKEN

  if (!platformToken) {
    throw new Error('platform_token_not_configured')
  }

  const res = await fetch(
    `${baseUrl}/platform/api/v1/users/${chatwootUserId}/login`,
    {
      method: 'GET',
      headers: {
        'api_access_token': platformToken,
      },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.warn(
      `[CREDENTIALS] Falha ao obter SSO do Chatwoot para user #${chatwootUserId}: ${res.status} ${detail}`
    )
    throw new Error('chatwoot_sso_failed')
  }

  const json = (await res.json()) as ChatwootSsoResponse
  const url = json.url?.trim()

  if (!url) {
    throw new Error('invalid_chatwoot_sso_payload')
  }

  return new URL(url, baseUrl).toString()
}

export async function GET() {
  const perm = await checkPermission('atendimento', 'view')

  if (!perm.allowed || !perm.session) {
    return perm.errorResponse ?? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const organizationId = perm.session.user.organizationId
  const sessionUser = perm.session.user as SessionUserLike
  const crmUserId =
    sessionUser.id?.trim() ||
    sessionUser.email?.trim() ||
    'unknown-user'

  const [organization, account] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        deletedAt: true,
        chatwootAccountId: true,
        chatwootUrl: true,
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
        organizationId: true,
        isActive: true,
        data: true,
        updatedAt: true,
        lastError: true,
      },
    }),
  ])

  if (!organization || organization.deletedAt) {
    return NextResponse.json(
      { error: 'organization_inactive' },
      { status: 403, headers: buildNoStoreHeaders() }
    )
  }

  if (!account || !account.isActive) {
    return NextResponse.json(
      { error: 'not_configured' },
      { status: 404, headers: buildNoStoreHeaders() }
    )
  }

  if (account.organizationId !== organizationId) {
    return NextResponse.json(
      { error: 'organization_mismatch' },
      { status: 403, headers: buildNoStoreHeaders() }
    )
  }

  const data = parseAccountData(account.data)
  if (!data) {
    return NextResponse.json(
      { error: 'invalid_chatwoot_payload' },
      { status: 409, headers: buildNoStoreHeaders() }
    )
  }

  const connectedAccountId = toPositiveInt(data.chatwootAccountId)
  if (!connectedAccountId) {
    return NextResponse.json(
      { error: 'no_credentials' },
      { status: 404, headers: buildNoStoreHeaders() }
    )
  }

  const orgChatwootAccountId = toPositiveInt(organization.chatwootAccountId)

  if (orgChatwootAccountId && orgChatwootAccountId !== connectedAccountId) {
    console.warn(
      `[CREDENTIALS] Divergência de account no Chatwoot para org ${organizationId}. ` +
        `organization.chatwootAccountId=${orgChatwootAccountId} connectedAccount.data.chatwootAccountId=${connectedAccountId}`
    )

    return NextResponse.json(
      {
        error: 'chatwoot_account_mismatch',
        detail: 'A integração do Chatwoot está inconsistente para esta organização',
      },
      { status: 409, headers: buildNoStoreHeaders() }
    )
  }

  const chatwootUrl =
    normalizeBaseUrl(process.env.CHATWOOT_API_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_CHATWOOT_URL) ||
    normalizeBaseUrl(organization.chatwootUrl) ||
    normalizeBaseUrl(data.chatwootUrl) ||
    'https://app.mundodigitalsolucoes.com.br'

  const chatwootUserId = toPositiveInt(data.chatwootUserId)

  if (!chatwootUserId) {
    return NextResponse.json(
      {
        error: 'missing_chatwoot_user_id',
        detail: 'Usuário do Chatwoot ausente para esta organização',
      },
      { status: 409, headers: buildNoStoreHeaders() }
    )
  }

  const ownerEmail = data.ownerEmail?.trim() || ''
  await confirmChatwootUser(chatwootUrl, ownerEmail)

  try {
    const ssoUrl = await getChatwootSsoUrl(chatwootUrl, chatwootUserId)

    return NextResponse.json(
      {
        organizationId,
        userId: crmUserId,
        cacheKey: `${organizationId}:${crmUserId}:${connectedAccountId}:${account.updatedAt.toISOString()}`,
        chatwootUrl,
        chatwootAccountId: connectedAccountId,
        ssoUrl,
      },
      {
        headers: buildNoStoreHeaders(),
      }
    )
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'chatwoot_sso_failed'

    return NextResponse.json(
      {
        error: reason,
        detail: 'Não foi possível iniciar a sessão automática do Atendimento',
      },
      { status: 409, headers: buildNoStoreHeaders() }
    )
  }
}