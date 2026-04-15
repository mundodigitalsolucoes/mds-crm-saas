/**
 * src/app/api/integrations/evolution/delete/route.ts
 *
 * Exclui um canal do CRM sem misturar com disconnect operacional.
 *
 * Regras:
 *  1. Permite excluir canal já desconectado OU canal zumbi/offline/missing
 *  2. Bloqueia exclusão apenas quando a instância estiver realmente OPEN
 *  3. Faz best effort de cleanup residual em Chatwoot/Evolution
 *  4. Marca a instância como arquivada no CRM
 *  5. Atualiza connected_accounts(provider='whatsapp') como sombra compatível
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/integrations/crypto'
import {
  disconnectInstance,
  getInstanceState,
} from '@/lib/integrations/evolutionClient'

type DeleteBody = {
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
      NOT: { status: 'archived' },
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

  const body = await req.json().catch(() => ({} as DeleteBody))

  if (!body.instanceId) {
    return NextResponse.json(
      { error: 'instanceId é obrigatório para excluir o canal.' },
      { status: 400 }
    )
  }

  const targetInstance = await prisma.whatsappInstance.findFirst({
    where: {
      id: body.instanceId,
      organizationId,
      NOT: { status: 'archived' },
    },
  })

  if (!targetInstance) {
    return NextResponse.json(
      { error: 'Canal não encontrado.' },
      { status: 404 }
    )
  }

  let state = 'inactive'

  try {
    state = await getInstanceState(targetInstance.instanceName)
  } catch {
    state = 'unknown'
  }

  if (targetInstance.isActive && state === 'open') {
    return NextResponse.json(
      { error: 'Desconecte o canal ativo antes de excluir do CRM.' },
      { status: 400 }
    )
  }

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

        await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { api_access_token: apiToken },
          signal: AbortSignal.timeout(8_000),
        })
      } catch (err) {
        console.warn('[DeleteChannel] Falha ao remover inbox residual (ignorado):', err)
      }
    }
  }

  try {
    await disconnectInstance(targetInstance.instanceName)
  } catch (err) {
    console.warn('[DeleteChannel] Falha ao limpar instância residual (ignorado):', err)
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

  const accessTokenEnc = EVO_KEY ? encryptToken(EVO_KEY) : ''

  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    accessTokenEnc,
    evoUrl: EVO_URL,
  })

  return NextResponse.json({
    success: true,
    instanceId: targetInstance.id,
    instanceName: targetInstance.instanceName,
  })
}