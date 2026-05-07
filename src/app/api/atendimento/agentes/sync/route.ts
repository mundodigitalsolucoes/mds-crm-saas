// src/app/api/atendimento/agentes/sync/route.ts
// Sincroniza agentes existentes do Atendimento com usuários ativos do CRM por e-mail.
// Não cria agente, não remove agente e não altera permissões.

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

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'edit'
  )

  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const credentials = await getChatwootCredentials(organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Atendimento não conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    const [agents, users] = await Promise.all([
      listChatwootAgents(credentials),
      prisma.user.findMany({
        where: {
          organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          chatwootUserId: true,
          isChatwootAgent: true,
        },
      }),
    ])

    const agentsByEmail = new Map(
      agents
        .filter((agent) => normalizeEmail(agent.email))
        .map((agent) => [normalizeEmail(agent.email), agent])
    )

    const updates = []

    for (const user of users) {
      const agent = agentsByEmail.get(normalizeEmail(user.email))

      if (!agent?.id) continue

      const needsUpdate =
        user.chatwootUserId !== agent.id || user.isChatwootAgent !== true

      if (!needsUpdate) continue

      updates.push(
        prisma.user.update({
          where: { id: user.id },
          data: {
            chatwootUserId: agent.id,
            isChatwootAgent: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            chatwootUserId: true,
            isChatwootAgent: true,
          },
        })
      )
    }

    const updatedUsers = await prisma.$transaction(updates)

    return NextResponse.json({
      success: true,
      scanned: {
        users: users.length,
        agents: agents.length,
      },
      updated: updatedUsers.length,
      users: updatedUsers,
    })
  } catch (error) {
    console.error('[ATENDIMENTO AGENTES SYNC] Erro ao sincronizar agentes:', error)

    return NextResponse.json(
      { error: 'Erro ao sincronizar agentes do Atendimento' },
      { status: 502 }
    )
  }
}