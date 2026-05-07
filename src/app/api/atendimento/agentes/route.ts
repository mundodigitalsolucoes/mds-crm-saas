// src/app/api/atendimento/agentes/route.ts
// Lista membros ativos do CRM com status de vínculo como agente no Atendimento.
// Não cria, não edita e não remove agentes.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/checkPermission'
import {
  getChatwootCredentials,
  listChatwootAgents,
} from '@/lib/chatwoot'

function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() || ''
}

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'view'
  )

  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const credentials = await getChatwootCredentials(organizationId)

  const users = await prisma.user.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      chatwootUserId: true,
      isChatwootAgent: true,
      createdAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  if (!credentials) {
    return NextResponse.json({
      connected: false,
      agents: users.map((user) => ({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        chatwootUserId: user.chatwootUserId,
        isChatwootAgent: user.isChatwootAgent,
        matchedInAtendimento: false,
        atendimentoRole: null,
        availabilityStatus: null,
        createdAt: user.createdAt,
      })),
    })
  }

  try {
    const chatwootAgents = await listChatwootAgents(credentials)

    const agentsById = new Map(
      chatwootAgents
        .filter((agent) => agent.id)
        .map((agent) => [agent.id, agent])
    )

    const agentsByEmail = new Map(
      chatwootAgents
        .filter((agent) => normalizeEmail(agent.email))
        .map((agent) => [normalizeEmail(agent.email), agent])
    )

    const agents = users.map((user) => {
      const agentById = user.chatwootUserId
        ? agentsById.get(user.chatwootUserId)
        : null

      const agentByEmail = agentsByEmail.get(normalizeEmail(user.email))

      const matchedAgent = agentById || agentByEmail || null

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        chatwootUserId: user.chatwootUserId,
        isChatwootAgent: user.isChatwootAgent,
        matchedInAtendimento: Boolean(matchedAgent),
        atendimentoAgentId: matchedAgent?.id ?? null,
        atendimentoRole: matchedAgent?.role ?? null,
        availabilityStatus: matchedAgent?.availability_status ?? null,
        createdAt: user.createdAt,
      }
    })

    return NextResponse.json({
      connected: true,
      agents,
      summary: {
        crmUsers: users.length,
        atendimentoAgents: chatwootAgents.length,
        linked: agents.filter((agent) => agent.chatwootUserId).length,
        matched: agents.filter((agent) => agent.matchedInAtendimento).length,
      },
    })
  } catch (error) {
    console.error('[ATENDIMENTO AGENTES] Erro ao listar agentes:', error)

    return NextResponse.json(
      { error: 'Erro ao listar agentes do Atendimento' },
      { status: 502 }
    )
  }
}