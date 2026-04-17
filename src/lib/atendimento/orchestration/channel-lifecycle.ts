// src/lib/atendimento/orchestration/channel-lifecycle.ts

import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/integrations/crypto'
import { setupChatwootEvolution } from '@/lib/integrations/chatwoot-evo'
import {
  createInstance,
  disconnectInstance,
  getInstanceState,
} from '@/lib/integrations/evolutionClient'

type LegacyWhatsappData = {
  instanceId?: string
  label?: string | null
  instanceName?: string
  serverUrl?: string
  phone?: string | null
  connectedAt?: string | null
  disconnectedAt?: string | null
  chatwootInboxId?: number | null
}

type ConnectWhatsappChannelInput = {
  organizationId: string
  userId: string
  label: string
  evoUrl: string
  evoKey: string
}

type ReconnectWhatsappChannelInput = {
  organizationId: string
  userId: string
  instanceId?: string
  evoUrl: string
  evoKey: string
}

type DisconnectWhatsappChannelInput = {
  organizationId: string
  userId: string
  instanceId?: string
  evoUrl: string
  evoKey: string
}

type DeleteWhatsappChannelInput = {
  organizationId: string
  userId: string
  instanceId?: string
  evoUrl: string
  evoKey: string
}

export class ChannelLifecycleError extends Error {
  status: number
  code?: string

  constructor(message: string, status = 500, code?: string) {
    super(message)
    this.name = 'ChannelLifecycleError'
    this.status = status
    this.code = code
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

function serializeLegacyShadow(params: {
  instanceId: string | null
  label: string | null
  instanceName: string | null
  evoUrl: string
  phone: string | null
  connectedAt: string | null
  chatwootInboxId: number | null
}) {
  const {
    instanceId,
    label,
    instanceName,
    evoUrl,
    phone,
    connectedAt,
    chatwootInboxId,
  } = params

  return JSON.stringify({
    instanceId,
    label,
    instanceName,
    serverUrl: evoUrl,
    phone,
    connectedAt,
    chatwootInboxId,
  })
}

function buildInstanceName(slug: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  return `org-${slug}-${suffix}`.toLowerCase()
}

function buildEvolutionAccessTokenEnc(evoKey: string): string {
  return evoKey ? encryptToken(evoKey) : ''
}

export function sanitizeWhatsappLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return fallback

  return normalized.slice(0, 60)
}

async function getOrganizationSlug(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  })

  if (!org) {
    throw new ChannelLifecycleError('Organização não encontrada.', 404)
  }

  return org.slug
}

export async function ensureLegacyWhatsappMirrored(params: {
  organizationId: string
  userId: string
  evoUrl: string
}) {
  const { organizationId, userId, evoUrl } = params

  const legacy = await prisma.connectedAccount.findUnique({
    where: { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: {
      data: true,
      isActive: true,
      lastError: true,
    },
  })

  if (!legacy?.isActive) return

  const parsed = safeJsonParse<LegacyWhatsappData>(legacy.data)
  if (!parsed?.instanceName) return

  const exists = await prisma.whatsappInstance.findUnique({
    where: { instanceName: parsed.instanceName },
    select: { id: true },
  })

  if (exists) return

  await prisma.whatsappInstance.create({
    data: {
      organizationId,
      connectedById: userId,
      label: parsed.label ?? 'WhatsApp principal',
      instanceName: parsed.instanceName,
      phoneNumber: parsed.phone ?? null,
      status: 'open',
      chatwootInboxId: parsed.chatwootInboxId ?? null,
      serverUrl: parsed.serverUrl ?? evoUrl,
      metadata: JSON.stringify(parsed),
      isActive: true,
      lastError: legacy.lastError,
      connectedAt: parsed.connectedAt ? new Date(parsed.connectedAt) : null,
      disconnectedAt: parsed.disconnectedAt ? new Date(parsed.disconnectedAt) : null,
    },
  })
}

async function syncLegacyWhatsappShadow(params: {
  organizationId: string
  userId: string
  evoUrl: string
  evoKey: string
}) {
  const { organizationId, userId, evoUrl, evoKey } = params
  const accessTokenEnc = buildEvolutionAccessTokenEnc(evoKey)

  const latestActive = await prisma.whatsappInstance.findFirst({
    where: {
      organizationId,
      isActive: true,
      NOT: { status: 'archived' },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })

  if (!latestActive) {
    await prisma.connectedAccount.upsert({
      where: { provider_organizationId: { provider: 'whatsapp', organizationId } },
      create: {
        provider: 'whatsapp',
        organizationId,
        connectedById: userId,
        accessTokenEnc,
        isActive: false,
        data: serializeLegacyShadow({
          instanceId: null,
          label: null,
          instanceName: null,
          evoUrl,
          phone: null,
          connectedAt: null,
          chatwootInboxId: null,
        }),
      },
      update: {
        connectedById: userId,
        accessTokenEnc,
        isActive: false,
        lastError: null,
        lastSyncAt: new Date(),
        data: serializeLegacyShadow({
          instanceId: null,
          label: null,
          instanceName: null,
          evoUrl,
          phone: null,
          connectedAt: null,
          chatwootInboxId: null,
        }),
      },
    })

    return
  }

  await prisma.connectedAccount.upsert({
    where: { provider_organizationId: { provider: 'whatsapp', organizationId } },
    create: {
      provider: 'whatsapp',
      organizationId,
      connectedById: userId,
      accessTokenEnc,
      isActive: true,
      data: serializeLegacyShadow({
        instanceId: latestActive.id,
        label: latestActive.label ?? null,
        instanceName: latestActive.instanceName,
        evoUrl: latestActive.serverUrl ?? evoUrl,
        phone: latestActive.phoneNumber ?? null,
        connectedAt: latestActive.connectedAt
          ? latestActive.connectedAt.toISOString()
          : null,
        chatwootInboxId: latestActive.chatwootInboxId ?? null,
      }),
    },
    update: {
      connectedById: userId,
      accessTokenEnc,
      isActive: true,
      lastError: null,
      lastSyncAt: new Date(),
      data: serializeLegacyShadow({
        instanceId: latestActive.id,
        label: latestActive.label ?? null,
        instanceName: latestActive.instanceName,
        evoUrl: latestActive.serverUrl ?? evoUrl,
        phone: latestActive.phoneNumber ?? null,
        connectedAt: latestActive.connectedAt
          ? latestActive.connectedAt.toISOString()
          : null,
        chatwootInboxId: latestActive.chatwootInboxId ?? null,
      }),
    },
  })
}

async function tryChatwootSetup(params: {
  organizationId: string
  orgSlug: string
  instanceName: string
  evoUrl: string
  evoKey: string
  phoneNumber: string | null
  inboxName: string
}): Promise<number | null> {
  try {
    const result = await setupChatwootEvolution(params)

    if (result.skipped) {
      console.log('[ChannelLifecycle] Chatwoot não configurado, pulando setup.')
    } else if (!result.success) {
      console.warn(
        '[ChannelLifecycle] Setup Chatwoot parcialmente falhou. InboxId:',
        result.chatwootInboxId
      )
    } else {
      console.log(
        '[ChannelLifecycle] Chatwoot configurado. InboxId:',
        result.chatwootInboxId
      )
    }

    return result.chatwootInboxId
  } catch (err) {
    console.error('[ChannelLifecycle] Erro no setup Chatwoot (ignorado):', err)
    return null
  }
}

async function removeChatwootInboxIfUnused(params: {
  organizationId: string
  targetInstanceId: string
  chatwootInboxId: number | null
}) {
  const { organizationId, targetInstanceId, chatwootInboxId } = params

  if (!chatwootInboxId) return

  const refs = await prisma.whatsappInstance.count({
    where: {
      organizationId,
      chatwootInboxId,
      id: { not: targetInstanceId },
      status: { not: 'archived' },
    },
  })

  if (refs > 0) return

  const cwAccount = await prisma.connectedAccount.findUnique({
    where: { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { accessTokenEnc: true, data: true, isActive: true },
  })

  if (!cwAccount?.isActive) return

  try {
    const cwData = JSON.parse(cwAccount.data) as {
      chatwootUrl: string
      chatwootAccountId: number
    }

    const apiToken = decryptToken(cwAccount.accessTokenEnc)
    const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
    const baseUrl = internalUrl ?? cwData.chatwootUrl.replace(/\/$/, '')
    const deleteUrl = `${baseUrl}/api/v1/accounts/${cwData.chatwootAccountId}/inboxes/${chatwootInboxId}`

    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { api_access_token: apiToken },
      signal: AbortSignal.timeout(8_000),
    })
  } catch (err) {
    console.warn('[ChannelLifecycle] Falha ao remover inbox Chatwoot (ignorado):', err)
  }
}

export async function connectWhatsappChannel(
  input: ConnectWhatsappChannelInput
) {
  const { organizationId, userId, label, evoUrl, evoKey } = input

  await ensureLegacyWhatsappMirrored({ organizationId, userId, evoUrl })

  const orgSlug = await getOrganizationSlug(organizationId)

  let instanceName = ''
  let created = false

  for (let attempt = 0; attempt < 3; attempt++) {
    instanceName = buildInstanceName(orgSlug)

    const state = await getInstanceState(instanceName)
    if (state !== 'not_found') continue

    created = await createInstance(instanceName)
    if (created) break
  }

  if (!created || !instanceName) {
    throw new ChannelLifecycleError(
      'Erro ao criar instância WhatsApp. Tente novamente.',
      502
    )
  }

  const connectRequestedAt = new Date().toISOString()

  const chatwootInboxId = await tryChatwootSetup({
    organizationId,
    orgSlug,
    instanceName,
    evoUrl,
    evoKey,
    phoneNumber: null,
    inboxName: label,
  })

  const whatsappInstance = await prisma.whatsappInstance.create({
    data: {
      organizationId,
      connectedById: userId,
      label,
      instanceName,
      phoneNumber: null,
      status: 'connecting',
      chatwootInboxId,
      serverUrl: evoUrl,
      metadata: JSON.stringify({
        label,
        instanceName,
        serverUrl: evoUrl,
        phone: null,
        connectedAt: null,
        chatwootInboxId,
        inboxDisplayName: label,
        connectRequestedAt,
      }),
      isActive: true,
      connectedAt: null,
    },
  })

  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    evoUrl,
    evoKey,
  })

  return {
    success: true,
    alreadyExists: false,
    instanceId: whatsappInstance.id,
    instanceName: whatsappInstance.instanceName,
    label: whatsappInstance.label,
    chatwootInboxId,
  }
}

export async function reconnectWhatsappChannel(
  input: ReconnectWhatsappChannelInput
) {
  const { organizationId, userId, instanceId, evoUrl, evoKey } = input

  await ensureLegacyWhatsappMirrored({ organizationId, userId, evoUrl })

  if (!instanceId) {
    throw new ChannelLifecycleError(
      'instanceId é obrigatório para reconectar.',
      400
    )
  }

  const orgSlug = await getOrganizationSlug(organizationId)

  const targetInstance = await prisma.whatsappInstance.findFirst({
    where: {
      id: instanceId,
      organizationId,
      NOT: { status: 'archived' },
    },
  })

  if (!targetInstance) {
    throw new ChannelLifecycleError(
      'Instância WhatsApp não encontrada.',
      404
    )
  }

  let state = await getInstanceState(targetInstance.instanceName)

  if (state === 'not_found') {
    const created = await createInstance(targetInstance.instanceName)

    if (!created) {
      throw new ChannelLifecycleError(
        'Erro ao recriar instância WhatsApp na Evolution.',
        502
      )
    }

    state = 'connecting'
  }

  const reconnectRequestedAt = new Date().toISOString()

  const chatwootInboxId = await tryChatwootSetup({
    organizationId,
    orgSlug,
    instanceName: targetInstance.instanceName,
    evoUrl,
    evoKey,
    phoneNumber: targetInstance.phoneNumber ?? null,
    inboxName: targetInstance.label ?? 'WA',
  })

  const nextChatwootInboxId =
    chatwootInboxId ?? targetInstance.chatwootInboxId ?? null

  const alreadyConnected = state === 'open'
  const previousMetadata =
    safeJsonParse<Record<string, unknown>>(targetInstance.metadata) ?? {}

  const connectedAtValue = alreadyConnected
    ? targetInstance.connectedAt ?? new Date()
    : null

  const updatedInstance = await prisma.whatsappInstance.update({
    where: { id: targetInstance.id },
    data: {
      isActive: true,
      status: alreadyConnected ? 'open' : 'connecting',
      serverUrl: evoUrl,
      chatwootInboxId: nextChatwootInboxId,
      lastError: null,
      disconnectedAt: null,
      phoneNumber: alreadyConnected ? targetInstance.phoneNumber : null,
      connectedAt: connectedAtValue,
      metadata: JSON.stringify({
        ...previousMetadata,
        instanceName: targetInstance.instanceName,
        serverUrl: evoUrl,
        chatwootInboxId: nextChatwootInboxId,
        inboxDisplayName: targetInstance.label ?? 'WA',
        reconnectRequestedAt,
        disconnectedAt: null,
        phone: alreadyConnected ? targetInstance.phoneNumber : null,
        connectedAt: connectedAtValue
          ? connectedAtValue.toISOString()
          : null,
      }),
    },
  })

  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    evoUrl,
    evoKey,
  })

  return {
    success: true,
    instanceId: updatedInstance.id,
    instanceName: updatedInstance.instanceName,
    label: updatedInstance.label,
    chatwootInboxId: updatedInstance.chatwootInboxId,
    alreadyConnected,
  }
}

export async function disconnectWhatsappChannel(
  input: DisconnectWhatsappChannelInput
) {
  const { organizationId, userId, instanceId, evoUrl, evoKey } = input

  await ensureLegacyWhatsappMirrored({ organizationId, userId, evoUrl })

  let targetInstance:
    | Awaited<ReturnType<typeof prisma.whatsappInstance.findFirst>>
    | null = null

  if (instanceId) {
    targetInstance = await prisma.whatsappInstance.findFirst({
      where: {
        id: instanceId,
        organizationId,
        isActive: true,
        NOT: { status: 'archived' },
      },
    })
  } else {
    const activeInstances = await prisma.whatsappInstance.findMany({
      where: {
        organizationId,
        isActive: true,
        NOT: { status: 'archived' },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 2,
    })

    if (activeInstances.length === 0) {
      return { success: true }
    }

    if (activeInstances.length > 1) {
      throw new ChannelLifecycleError(
        'Mais de uma instância ativa encontrada. Informe o instanceId para desconectar a instância correta.',
        400,
        'INSTANCE_ID_REQUIRED'
      )
    }

    targetInstance = activeInstances[0]
  }

  if (!targetInstance) {
    throw new ChannelLifecycleError(
      'Instância WhatsApp não encontrada.',
      404
    )
  }

  const previousMetadata =
    safeJsonParse<Record<string, unknown>>(targetInstance.metadata) ?? {}

  await removeChatwootInboxIfUnused({
    organizationId,
    targetInstanceId: targetInstance.id,
    chatwootInboxId: targetInstance.chatwootInboxId,
  })

  try {
    await disconnectInstance(targetInstance.instanceName)
  } catch (err) {
    console.warn(
      '[ChannelLifecycle] Falha ao limpar instância na Evolution (seguindo com cleanup local):',
      err
    )
  }

  await prisma.whatsappInstance.update({
    where: { id: targetInstance.id },
    data: {
      isActive: false,
      status: 'disconnected',
      chatwootInboxId: null,
      phoneNumber: null,
      lastError: null,
      disconnectedAt: new Date(),
      metadata: JSON.stringify({
        ...previousMetadata,
        disconnectedAt: new Date().toISOString(),
        lastChatwootInboxId: targetInstance.chatwootInboxId ?? null,
      }),
    },
  })

  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    evoUrl,
    evoKey,
  })

  return {
    success: true,
    instanceId: targetInstance.id,
    instanceName: targetInstance.instanceName,
  }
}

export async function deleteWhatsappChannel(
  input: DeleteWhatsappChannelInput
) {
  const { organizationId, userId, instanceId, evoUrl, evoKey } = input

  await ensureLegacyWhatsappMirrored({ organizationId, userId, evoUrl })

  if (!instanceId) {
    throw new ChannelLifecycleError(
      'instanceId é obrigatório para excluir o canal.',
      400
    )
  }

  const targetInstance = await prisma.whatsappInstance.findFirst({
    where: {
      id: instanceId,
      organizationId,
      NOT: { status: 'archived' },
    },
  })

  if (!targetInstance) {
    throw new ChannelLifecycleError('Canal não encontrado.', 404)
  }

  let state = 'inactive'

  try {
    state = await getInstanceState(targetInstance.instanceName)
  } catch {
    state = 'unknown'
  }

  if (targetInstance.isActive && state === 'open') {
    throw new ChannelLifecycleError(
      'Desconecte o canal ativo antes de excluir do CRM.',
      400
    )
  }

  await removeChatwootInboxIfUnused({
    organizationId,
    targetInstanceId: targetInstance.id,
    chatwootInboxId: targetInstance.chatwootInboxId,
  })

  try {
    await disconnectInstance(targetInstance.instanceName)
  } catch (err) {
    console.warn(
      '[ChannelLifecycle] Falha ao limpar instância residual (ignorado):',
      err
    )
  }

  const previousMetadata =
    safeJsonParse<Record<string, unknown>>(targetInstance.metadata) ?? {}

  await prisma.whatsappInstance.update({
    where: { id: targetInstance.id },
    data: {
      status: 'archived',
      isActive: false,
      chatwootInboxId: null,
      lastError: null,
      metadata: JSON.stringify({
        ...previousMetadata,
        deletedFromCrmAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
        lastChatwootInboxId: targetInstance.chatwootInboxId ?? null,
      }),
    },
  })

  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    evoUrl,
    evoKey,
  })

  return {
    success: true,
    instanceId: targetInstance.id,
    instanceName: targetInstance.instanceName,
  }
}