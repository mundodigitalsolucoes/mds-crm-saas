/**
 * src/app/api/integrations/evolution/status/route.ts
 *
 * Status global para banner do app.
 * Multi-WA:
 * - se ao menos uma instância ativa estiver OPEN, considera conectado
 * - se houver instância em janela de conexão, não dispara banner vermelho
 * - não usa connected_accounts legado como fonte primária
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { getInstanceState } from '@/lib/integrations/evolutionClient'

const CONNECTION_GRACE_MS = 90_000

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const activeInstances = await prisma.whatsappInstance.findMany({
    where: {
      organizationId,
      isActive: true,
      NOT: { status: 'archived' },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  if (!activeInstances.length) {
    return NextResponse.json({ connected: false })
  }

  const now = Date.now()

  const states = await Promise.all(
    activeInstances.map(async (instance) => {
      let state = 'unknown'

      try {
        state = await getInstanceState(instance.instanceName)
      } catch {
        state = 'unknown'
      }

      const metadata =
        safeJsonParse<Record<string, unknown>>(instance.metadata) ?? {}

      const transitionAt =
        parseIsoDate(metadata.reconnectRequestedAt) ??
        parseIsoDate(metadata.connectRequestedAt)

      const inGrace =
        !!transitionAt && now - transitionAt.getTime() < CONNECTION_GRACE_MS

      return {
        instance,
        state,
        inGrace,
      }
    })
  )

  const openState = states.find((item) => item.state === 'open')
  if (openState) {
    return NextResponse.json({
      connected: true,
      isConnected: true,
      instanceName: openState.instance.instanceName,
      label: openState.instance.label ?? null,
      disconnectedAt: null,
      activeCount: activeInstances.length,
      connectedCount: states.filter((item) => item.state === 'open').length,
    })
  }

  const connectingState = states.find(
    (item) => item.state === 'connecting' || item.inGrace
  )

  if (connectingState) {
    return NextResponse.json({
      connected: true,
      isConnected: true,
      unstable: true,
      instanceName: connectingState.instance.instanceName,
      label: connectingState.instance.label ?? null,
      disconnectedAt: null,
      activeCount: activeInstances.length,
      connectedCount: 0,
    })
  }

  const reference = states[0]?.instance ?? null

  return NextResponse.json({
    connected: true,
    isConnected: false,
    instanceName: reference?.instanceName ?? null,
    label: reference?.label ?? null,
    disconnectedAt:
      reference?.disconnectedAt?.toISOString?.() ??
      new Date().toISOString(),
    activeCount: activeInstances.length,
    connectedCount: 0,
    lostConnection: states.every((item) => item.state === 'not_found'),
  })
}