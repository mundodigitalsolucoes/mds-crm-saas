// src/lib/atendimento/orchestration/channel-status.ts

import { prisma } from '@/lib/prisma'
import {
  fetchInstanceInfo,
  getInstanceState,
  type EvolutionConnectionState,
} from '@/lib/integrations/evolutionClient'

export type InstanceStatus =
  | 'connected'
  | 'connecting'
  | 'offline'
  | 'missing'
  | 'disconnected'

const CONNECTION_GRACE_MS = 90_000

type LegacyWhatsappData = {
  label?: string | null
  instanceName?: string
  serverUrl?: string | null
  phone?: string | null
  connectedAt?: string | null
  disconnectedAt?: string | null
  chatwootInboxId?: number | null
}

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

function resolveStatus(params: {
  isActive: boolean
  state: EvolutionConnectionState | 'inactive'
}): InstanceStatus {
  const { isActive, state } = params

  if (!isActive) return 'disconnected'
  if (state === 'open') return 'connected'
  if (state === 'connecting') return 'connecting'
  if (state === 'not_found') return 'missing'
  return 'offline'
}

export async function ensureLegacyWhatsappMirroredIfNeeded(organizationId: string) {
  const currentCount = await prisma.whatsappInstance.count({
    where: { organizationId },
  })

  if (currentCount > 0) return

  const legacy = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'whatsapp', organizationId },
    },
    select: {
      data: true,
      isActive: true,
      lastError: true,
    },
  })

  if (!legacy?.isActive) return

  const parsed = safeJsonParse<LegacyWhatsappData>(legacy.data)
  if (!parsed?.instanceName) return

  await prisma.whatsappInstance.create({
    data: {
      organizationId,
      connectedById: null,
      label: parsed.label ?? 'WhatsApp principal',
      instanceName: parsed.instanceName,
      phoneNumber: parsed.phone ?? null,
      status: 'connecting',
      chatwootInboxId: parsed.chatwootInboxId ?? null,
      serverUrl: parsed.serverUrl ?? null,
      metadata: JSON.stringify(parsed),
      isActive: true,
      lastError: legacy.lastError,
      connectedAt: parsed.connectedAt ? new Date(parsed.connectedAt) : null,
      disconnectedAt: parsed.disconnectedAt ? new Date(parsed.disconnectedAt) : null,
    },
  })
}

async function resolvePhoneNumber(instanceName: string): Promise<string | null> {
  try {
    const info = await fetchInstanceInfo(instanceName)
    const wuid = info?.instance?.wuid ?? null
    return wuid ? (wuid.split('@')[0] ?? null) : null
  } catch {
    return null
  }
}

export async function readWhatsappInstanceRuntime(instance: {
  id: string
  label: string | null
  instanceName: string
  phoneNumber: string | null
  status: string
  isActive: boolean
  chatwootInboxId: number | null
  connectedAt: Date | null
  disconnectedAt: Date | null
  lastError: string | null
  metadata: string | null
  createdAt: Date
  updatedAt: Date
}) {
  const parsedMetadata =
    safeJsonParse<Record<string, unknown>>(instance.metadata) ?? {}

  const connectRequestedAt =
    parseIsoDate(parsedMetadata.connectRequestedAt) ??
    parseIsoDate(parsedMetadata.reconnectRequestedAt)

  const metadataConnectedAt = parseIsoDate(parsedMetadata.connectedAt)
  const metadataDisconnectedAt = parseIsoDate(parsedMetadata.disconnectedAt)

  const inGraceWindow =
    !!connectRequestedAt &&
    Date.now() - connectRequestedAt.getTime() < CONNECTION_GRACE_MS

  let rawState: EvolutionConnectionState | 'inactive' = 'inactive'

  if (instance.isActive) {
    try {
      rawState = await getInstanceState(instance.instanceName)
    } catch {
      rawState = 'unknown'
    }
  }

  let effectiveState: EvolutionConnectionState | 'inactive' = rawState

  if (
    instance.isActive &&
    rawState !== 'open' &&
    (rawState === 'connecting' || inGraceWindow)
  ) {
    effectiveState = 'connecting'
  }

  const isConnected = effectiveState === 'open'

  let phoneNumber = instance.phoneNumber
  if (isConnected && !phoneNumber) {
    phoneNumber = await resolvePhoneNumber(instance.instanceName)
  }

  const connectedAt =
    isConnected
      ? instance.connectedAt ?? metadataConnectedAt ?? null
      : instance.connectedAt ?? metadataConnectedAt ?? null

  const disconnectedAt =
    !isConnected && effectiveState !== 'connecting'
      ? instance.disconnectedAt ?? metadataDisconnectedAt ?? instance.updatedAt
      : null

  const lastError =
    effectiveState === 'connecting'
      ? null
      : isConnected
        ? null
        : instance.lastError ?? 'WhatsApp desconectado. Verifique o celular.'

  const status = resolveStatus({
    isActive: instance.isActive,
    state: effectiveState,
  })

  return {
    id: instance.id,
    label: instance.label ?? 'WhatsApp sem nome',
    instanceName: instance.instanceName,
    phoneNumber,
    status,
    isActive: instance.isActive,
    isConnected,
    chatwootInboxId: instance.chatwootInboxId,
    connectedAt: connectedAt ? connectedAt.toISOString() : null,
    disconnectedAt: disconnectedAt ? disconnectedAt.toISOString() : null,
    lastError,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
    rawState,
    effectiveState,
    inGraceWindow,
  }
}

export async function readWhatsappGlobalStatus(organizationId: string) {
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
    return {
      connected: false,
      isConnected: false,
      activeCount: 0,
      connectedCount: 0,
    }
  }

  const runtimes = await Promise.all(
    activeInstances.map((instance) => readWhatsappInstanceRuntime(instance))
  )

  const connectedItems = runtimes.filter((item) => item.isConnected)
  const openState = connectedItems[0]

  if (openState) {
    return {
      connected: true,
      isConnected: true,
      unstable: false,
      instanceName: openState.instanceName,
      label: openState.label ?? null,
      disconnectedAt: null,
      activeCount: activeInstances.length,
      connectedCount: connectedItems.length,
    }
  }

  const connectingState = runtimes.find(
    (item) => item.effectiveState === 'connecting' || item.inGraceWindow
  )

  if (connectingState) {
    return {
      connected: false,
      isConnected: false,
      unstable: true,
      instanceName: connectingState.instanceName,
      label: connectingState.label ?? null,
      disconnectedAt: null,
      activeCount: activeInstances.length,
      connectedCount: 0,
    }
  }

  const reference = runtimes[0]

  return {
    connected: false,
    isConnected: false,
    unstable: false,
    instanceName: reference?.instanceName ?? null,
    label: reference?.label ?? null,
    disconnectedAt:
      reference?.disconnectedAt ??
      new Date().toISOString(),
    activeCount: activeInstances.length,
    connectedCount: 0,
    lostConnection: runtimes.every((item) => item.rawState === 'not_found'),
  }
}

export async function listWhatsappInstancesWithRuntime(organizationId: string) {
  await ensureLegacyWhatsappMirroredIfNeeded(organizationId)

  const dbInstances = await prisma.whatsappInstance.findMany({
    where: {
      organizationId,
      NOT: { status: 'archived' },
    },
    orderBy: [
      { isActive: 'desc' },
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return Promise.all(
    dbInstances.map((instance) => readWhatsappInstanceRuntime(instance))
  )
}