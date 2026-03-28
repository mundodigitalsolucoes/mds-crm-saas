// src/app/api/integrations/chatwoot/credentials/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

type ChatwootAccountData = {
  chatwootAccountId?: number | string
  chatwootUrl?: string
  ownerEmail?: string
  ownerPasswordEnc?: string
  chatwootUserId?: number | string
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

export async function GET() {
  const perm = await checkPermission('integrations', 'view')

  if (!perm.allowed || !perm.session) {
    return perm.errorResponse ?? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const organizationId = perm.session.user.organizationId

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
    return NextResponse.json({ error: 'organization_inactive' }, { status: 403 })
  }

  if (!account || !account.isActive) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 })
  }

  if (account.organizationId !== organizationId) {
    return NextResponse.json({ error: 'organization_mismatch' }, { status: 403 })
  }

  const data = parseAccountData(account.data)
  if (!data) {
    return NextResponse.json({ error: 'invalid_chatwoot_payload' }, { status: 409 })
  }

  const connectedAccountId = toPositiveInt(data.chatwootAccountId)
  if (!connectedAccountId) {
    return NextResponse.json({ error: 'no_credentials' }, { status: 404 })
  }

  const orgChatwootAccountId = toPositiveInt(organization.chatwootAccountId)

  // Blindagem principal:
  // se a organization já tem um accountId salvo e ele diverge do connectedAccount,
  // bloqueia para não abrir atendimento herdado de outra org
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
      { status: 409 }
    )
  }

  const chatwootUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_CHATWOOT_URL) ||
    normalizeBaseUrl(organization.chatwootUrl) ||
    normalizeBaseUrl(data.chatwootUrl) ||
    'https://app.mundodigitalsolucoes.com.br'

  const email = data.ownerEmail?.trim() || ''
  const password = data.ownerPasswordEnc ? decryptToken(data.ownerPasswordEnc) : ''

  if (!email || !password) {
    return NextResponse.json(
      {
        error: 'invalid_chatwoot_owner_credentials',
        detail: 'Credenciais do owner do Chatwoot ausentes ou inválidas',
      },
      { status: 409 }
    )
  }

  // Confirma o usuário automaticamente antes de retornar as credenciais
  const secret = process.env.CHATWOOT_SUPER_ADMIN_TOKEN
  if (secret) {
    try {
      const confirmRes = await fetch(
        `${chatwootUrl}/sso/confirm-user?email=${encodeURIComponent(email)}&secret=${encodeURIComponent(secret)}`,
        { signal: AbortSignal.timeout(5_000) }
      )

      if (confirmRes.ok) {
        console.info(`[CREDENTIALS] Usuário ${email} confirmado`)
      }
    } catch {
      // Não bloqueia o carregamento do atendimento
    }
  }

  return NextResponse.json({
    organizationId,
    cacheKey: `${organizationId}:${connectedAccountId}:${account.updatedAt.toISOString()}`,
    email,
    password,
    chatwootUrl,
    chatwootAccountId: connectedAccountId,
  })
}