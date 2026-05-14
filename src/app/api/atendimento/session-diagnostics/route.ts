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

function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() || ''
}

export async function GET() {
  const perm = await checkPermission('atendimento', 'view')

  if (!perm.allowed || !perm.session) {
    return perm.errorResponse ?? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const organizationId = perm.session.user.organizationId
  const sessionUserId = perm.session.user.id
  const sessionEmail = perm.session.user.email

  const [user, account, credentials] = await Promise.all([
    prisma.user.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          ...(sessionUserId ? [{ id: sessionUserId }] : []),
          ...(sessionEmail ? [{ email: sessionEmail }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        chatwootUserId: true,
        isChatwootAgent: true,
        atendimentoVisibility: true,
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
      ssoStatus: 'not_tested' as 'not_tested' | 'ok' | 'failed' | 'missing_user_id',
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
    result.chatwoot.ssoError = login.url ? null : 'Platform API não retornou URL'
  } catch (error) {
    result.chatwoot.ssoStatus = 'failed'
    result.chatwoot.ssoError =
      error instanceof Error ? error.message : 'Erro ao gerar SSO'
  }

  return NextResponse.json(result)
}