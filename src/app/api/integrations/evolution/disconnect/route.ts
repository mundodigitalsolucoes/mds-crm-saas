/**
 * src/app/api/integrations/evolution/disconnect/route.ts
 *
 * Desconecta UMA instância WhatsApp da organização:
 *  1. Verifica permissão
 *  2. Espelha legado em whatsapp_instances, se existir
 *  3. Resolve a instância alvo por instanceId
 *  4. Remove inbox do Chatwoot
 *  5. Logout + delete da instância na Evolution
 *  6. Desativa a instância no banco
 *  7. Atualiza connected_accounts(provider='whatsapp') como sombra compatível
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/integrations/crypto'
import { disconnectInstance } from '@/lib/integrations/evolutionClient'

type DisconnectBody = {
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

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''
  const organizationId = session!.user.organizationId
  const userId = session!.user.id

  await ensureLegacyWhatsappMirrored({
    organizationId,
    userId,
    evoUrl: EVO_URL,
  })

  const body = await req.json().catch(() => ({} as DisconnectBody))

  let targetInstance = null

  if (body.instanceId) {
    targetInstance = await prisma.whatsappInstance.findFirst({
      where: {
        id: body.instanceId,
        organizationId,
        isActive: true,
      },
    })
  } else {
    const activeInstances = await prisma.whatsappInstance.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 2,
    })

    if (activeInstances.length === 0) {
      console.log('[Disconnect] Nenhuma instância WA no banco - já desconectado.')
      return NextResponse.json({ success: true })
    }

    if (activeInstances.length > 1) {
      return NextResponse.json(
        {
          error: 'Mais de uma instância ativa encontrada. Informe o instanceId para desconectar a instância correta.',
          code: 'INSTANCE_ID_REQUIRED',
        },
        { status: 400 }
      )
    }

    targetInstance = activeInstances[0]
  }

  if (!targetInstance) {
    return NextResponse.json(
      { error: 'Instância WhatsApp não encontrada.' },
      { status: 404 }
    )
  }

  console.log(`[Disconnect] Iniciando disconnect para: ${targetInstance.instanceName}`)

  // 1. Remove inbox do Chatwoot
  if (targetInstance.chatwootInboxId) {
    const cwAccount = await prisma.connectedAccount.findUnique({
      where: { provider_organizationId: { provider: 'chatwoot', organizationId } },
      select: { accessTokenEnc: true, data: true, isActive: true },
    })

    if (cwAccount?.isActive) {
      try {
        const cwData = JSON.parse(cwAccount.data) as {
          chatwootUrl: string
          chatwootAccountId: number
        }

        const apiToken = decryptToken(cwAccount.accessTokenEnc)
        const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
        const baseUrl = internalUrl ?? cwData.chatwootUrl.replace(/\/$/, '')

        const deleteUrl = `${baseUrl}/api/v1/accounts/${cwData.chatwootAccountId}/inboxes/${targetInstance.chatwootInboxId}`
        console.log(`[Disconnect] Removendo inbox Chatwoot id=${targetInstance.chatwootInboxId}`)

        const res = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { api_access_token: apiToken },
          signal: AbortSignal.timeout(8_000),
        })

        if (res.ok || res.status === 404) {
          console.log(`[Disconnect] Inbox Chatwoot removido (status=${res.status})`)
        } else {
          const responseBody = await res.text().catch(() => '')
          console.warn(`[Disconnect] Falha ao remover inbox: status=${res.status} body=${responseBody}`)
        }
      } catch (err) {
        console.warn('[Disconnect] Exceção ao remover inbox Chatwoot (ignorado):', err)
      }
    }
  }

  // 2. Logout + delete na Evolution
  await disconnectInstance(targetInstance.instanceName)
  console.log(`[Disconnect] Evolution logout+delete concluído para: ${targetInstance.instanceName}`)

  // 3. Desativa no banco
  const previousMetadata = safeJsonParse<Record<string, unknown>>(targetInstance.metadata) ?? {}

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

  // 4. Atualiza sombra compatível
  const accessTokenEnc = EVO_KEY ? encryptToken(EVO_KEY) : ''

  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    accessTokenEnc,
    evoUrl: EVO_URL,
  })

  console.log(`[Disconnect] Concluído para: ${targetInstance.instanceName}`)

  return NextResponse.json({
    success: true,
    instanceId: targetInstance.id,
    instanceName: targetInstance.instanceName,
  })
}