/**
 * src/app/api/integrations/evolution/reconnect/route.ts
 *
 * Reconecta UMA instância WhatsApp existente da organização:
 *  1. Verifica permissão
 *  2. Resolve a instância por instanceId
 *  3. Recria a instância na Evolution se ela não existir mais
 *  4. Garante inbox individual no Chatwoot para a própria instância
 *  5. Reativa a mesma linha em whatsapp_instances
 *  6. Atualiza connected_accounts(provider='whatsapp') como sombra compatível
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'
import { setupChatwootEvolution } from '@/lib/integrations/chatwoot-evo'
import {
  createInstance,
  getInstanceState,
} from '@/lib/integrations/evolutionClient'

type ReconnectBody = {
  instanceId?: string
}

type LegacyWhatsappData = {
  instanceId?: string
  label?: string | null
  instanceName?: string
  serverUrl?: string
  phone?: string | null
  connectedAt?: string | null
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

async function ensureLegacyWhatsappMirrored(params: {
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
    },
  })
}

async function syncLegacyWhatsappShadow(params: {
  organizationId: string
  userId: string
  accessTokenEnc: string
  evoUrl: string
}) {
  const { organizationId, userId, accessTokenEnc, evoUrl } = params

  const latestActive = await prisma.whatsappInstance.findFirst({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
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
}): Promise<number | null> {
  try {
    const result = await setupChatwootEvolution(params)

    if (result.skipped) {
      console.log('[Reconnect] Chatwoot não configurado, pulando setup.')
    } else if (!result.success) {
      console.warn(
        '[Reconnect] Setup Chatwoot parcialmente falhou. InboxId:',
        result.chatwootInboxId
      )
    } else {
      console.log('[Reconnect] Chatwoot configurado. InboxId:', result.chatwootInboxId)
    }

    return result.chatwootInboxId
  } catch (err) {
    console.error('[Reconnect] Erro no setup Chatwoot (ignorado):', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''

  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json(
      { error: 'Servidor WhatsApp não configurado.' },
      { status: 500 }
    )
  }

  const organizationId = session!.user.organizationId
  const userId = session!.user.id

  await ensureLegacyWhatsappMirrored({
    organizationId,
    userId,
    evoUrl: EVO_URL,
  })

  const body = await req.json().catch(() => ({} as ReconnectBody))

  if (!body.instanceId) {
    return NextResponse.json(
      { error: 'instanceId é obrigatório para reconectar.' },
      { status: 400 }
    )
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  })

  if (!org) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      { status: 404 }
    )
  }

  const targetInstance = await prisma.whatsappInstance.findFirst({
    where: {
      id: body.instanceId,
      organizationId,
    },
  })

  if (!targetInstance) {
    return NextResponse.json(
      { error: 'Instância WhatsApp não encontrada.' },
      { status: 404 }
    )
  }

  console.log(`[Reconnect] Iniciando reconnect para: ${targetInstance.instanceName}`)

  let state = await getInstanceState(targetInstance.instanceName)

  if (state === 'not_found') {
    const created = await createInstance(targetInstance.instanceName)

    if (!created) {
      return NextResponse.json(
        { error: 'Erro ao recriar instância WhatsApp na Evolution.' },
        { status: 502 }
      )
    }

    state = 'connecting'
    console.log(
      `[Reconnect] Instância recriada na Evolution: ${targetInstance.instanceName}`
    )
  }

  const chatwootInboxId = await tryChatwootSetup({
    organizationId,
    orgSlug: org.slug,
    instanceName: targetInstance.instanceName,
    evoUrl: EVO_URL,
    evoKey: EVO_KEY,
    phoneNumber: targetInstance.phoneNumber ?? null,
  })

  const nextChatwootInboxId =
    chatwootInboxId ?? targetInstance.chatwootInboxId ?? null

  const alreadyConnected = state === 'open'
  const previousMetadata =
    safeJsonParse<Record<string, unknown>>(targetInstance.metadata) ?? {}

  const updatedInstance = await prisma.whatsappInstance.update({
    where: { id: targetInstance.id },
    data: {
      isActive: true,
      status: alreadyConnected ? 'open' : 'connecting',
      serverUrl: EVO_URL,
      chatwootInboxId: nextChatwootInboxId,
      lastError: null,
      disconnectedAt: null,
      phoneNumber: alreadyConnected ? targetInstance.phoneNumber : null,
      connectedAt: alreadyConnected
        ? targetInstance.connectedAt ?? new Date()
        : null,
      metadata: JSON.stringify({
        ...previousMetadata,
        instanceName: targetInstance.instanceName,
        serverUrl: EVO_URL,
        chatwootInboxId: nextChatwootInboxId,
        reconnectRequestedAt: new Date().toISOString(),
        disconnectedAt: null,
        phone: alreadyConnected ? targetInstance.phoneNumber : null,
        connectedAt: alreadyConnected
          ? (targetInstance.connectedAt ?? new Date()).toISOString()
          : null,
      }),
    },
  })

  const accessTokenEnc = encryptToken(EVO_KEY)

  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    accessTokenEnc,
    evoUrl: EVO_URL,
  })

  console.log(
    `[Reconnect] Concluído para: ${updatedInstance.instanceName} | alreadyConnected=${alreadyConnected}`
  )

  return NextResponse.json({
    success: true,
    instanceId: updatedInstance.id,
    instanceName: updatedInstance.instanceName,
    label: updatedInstance.label,
    chatwootInboxId: updatedInstance.chatwootInboxId,
    alreadyConnected,
  })
}