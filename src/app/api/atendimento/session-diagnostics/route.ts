// src/app/api/atendimento/session-diagnostics/route.ts
// Diagnóstico seguro da sessão do Atendimento.
// Não altera core, não altera iframe e não executa login.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/checkPermission'
import {
  chatwootPlatformApi,
  getChatwootCredentials,
  listChatwootAgents,
} from '@/lib/chatwoot'

type PlatformLoginResponse = {
  url?: string
}

type SafeUser = {
  id: string
  name: string
  email: string
  role: string
  chatwootUserId: number | null
  isChatwootAgent: boolean
  atendimentoVisibility?: string | null
}

function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() || ''
}

async function getSafeUser(params: {
  organizationId: string
  sessionUserId?: string
  sessionEmail?: string | null
}): Promise<SafeUser | null> {
  const where = {
    organizationId: params.organizationId,
    deletedAt: null,
    OR: [
      ...(params.sessionUserId ? [{ id: params.sessionUserId }] : []),
      ...(params.sessionEmail ? [{ email: params.sessionEmail }] : []),
    ],
  }

  try {
    return await prisma.user.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        chatwootUserId: true,
        isChatwootAgent: true,
        atendimentoVisibility: true,
      },
    })
  } catch {
    return await prisma.user.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        chatwootUserId: true,
        isChatwootAgent: true,
      },
    })
  }
}

export async function GET() {
  try {
    const perm = await checkPermission('atendimento', 'view')

    if (!perm.allowed || !perm.session) {
      return (
        perm.errorResponse ??
        NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      )
    }

    const organizationId = perm.session.user.organizationId
    const sessionUserId = perm.session.user.id
    const sessionEmail = perm.session.user.email

    const [user, account, credentials] = await Promise.all([
      getSafeUser({
        organizationId,
        sessionUserId,
        sessionEmail,
      }),

      prisma.connectedAccount.findUnique({
        where: {
          provider_organizationId: {
            provider: 'chatwoot',
            organizationId,
          },
        },
        select: {
          isActive: true,
          data: true,
          lastError: true,
          updatedAt: true,
        },
      }),

      getChatwootCredentials(organizationId),
    ])

    const result = {
      organizationId,
      session: {
        userId: sessionUserId,
        email: sessionEmail,
      },
      crmUser: user,
      connectedAccount: {
        exists: Boolean(account),
        isActive: account?.isActive ?? false,
        lastError: account?.lastError ?? null,
        updatedAt: account?.updatedAt ?? null,
      },
      chatwoot: {
        connected: Boolean(credentials),
        accountId: credentials?.accountId ?? null,
        url: credentials?.chatwootUrl ?? null,
        userFoundById: false,
        userFoundByEmail: false,
        ssoStatus: 'not_tested' as
          | 'not_tested'
          | 'ok'
          | 'failed'
          | 'missing_user_id',
        ssoError: null as string | null,
      },
    }

    if (!credentials || !user) {
      return NextResponse.json(result)
    }

    try {
      const agents = await listChatwootAgents(credentials)

      result.chatwoot.userFoundById = user.chatwootUserId
        ? agents.some((agent) => agent.id === user.chatwootUserId)
        : false

      result.chatwoot.userFoundByEmail = agents.some(
        (agent) => normalizeEmail(agent.email) === normalizeEmail(user.email)
      )
    } catch (error) {
      result.chatwoot.ssoError =
        error instanceof Error ? error.message : 'Erro ao listar agentes'
    }

    if (!user.chatwootUserId) {
      result.chatwoot.ssoStatus = 'missing_user_id'
      return NextResponse.json(result)
    }

    try {
      const login = await chatwootPlatformApi<PlatformLoginResponse>(
        credentials.chatwootUrl,
        `/users/${user.chatwootUserId}/login`
      )

      result.chatwoot.ssoStatus = login.url ? 'ok' : 'failed'
      result.chatwoot.ssoError = login.url
        ? null
        : 'Platform API não retornou URL'
    } catch (error) {
      result.chatwoot.ssoStatus = 'failed'
      result.chatwoot.ssoError =
        error instanceof Error ? error.message : 'Erro ao gerar SSO'
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[ATENDIMENTO SESSION DIAGNOSTICS] Erro:', error)

    return NextResponse.json(
      {
        error: 'session_diagnostics_failed',
        detail: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}