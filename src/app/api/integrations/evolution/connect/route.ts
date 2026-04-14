/**
 * src/app/api/integrations/evolution/connect/route.ts
 *
 * Conecta uma NOVA instância WhatsApp para a organização.
 *
 * Regras:
 *  1. Verifica permissão de integrações
 *  2. Verifica status do plano
 *  3. Espelha legado (connected_accounts.whatsapp) em whatsapp_instances, se existir
 *  4. Verifica limite do plano para maxWhatsappInstances
 *  5. Cria uma instância nova com nome único
 *  6. Configura Chatwoot automaticamente (não bloqueia em caso de falha)
 *  7. Salva em whatsapp_instances
 *  8. Atualiza connected_accounts(provider='whatsapp') como sombra compatível
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { checkPlanActive, checkWhatsappInstanceLimit } from '@/lib/checkLimits'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'
import { setupChatwootEvolution } from '@/lib/integrations/chatwoot-evo'
import {
  getInstanceState,
  createInstance,
} from '@/lib/integrations/evolutionClient'

// ─── Tipos locais ──────────────────────────────────────────────────────────────

type ConnectBody = {
  label?: string
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

// ─── Helpers locais ───────────────────────────────────────────────────────────

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function sanitizeLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return fallback

  return normalized.slice(0, 60)
}

function buildInstanceName(slug: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  return `org-${slug}-${suffix}`.toLowerCase()
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
      console.log('[Connect] Chatwoot não configurado, pulando setup.')
    } else if (!result.success) {
      console.warn('[Connect] Setup Chatwoot parcialmente falhou. InboxId:', result.chatwootInboxId)
    } else {
      console.log('[Connect] Chatwoot configurado. InboxId:', result.chatwootInboxId)
    }

    return result.chatwootInboxId
  } catch (err) {
    console.error('[Connect] Erro no setup Chatwoot (ignorado):', err)
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''

  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json({ error: 'Servidor WhatsApp não configurado.' }, { status: 500 })
  }

  const organizationId = session!.user.organizationId
  const userId = session!.user.id

  const planCheck = await checkPlanActive(organizationId)
  if (!planCheck.active) return planCheck.errorResponse!

  const body = await req.json().catch(() => ({} as ConnectBody))

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      slug: true,
      chatwootAccountId: true,
    },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
  }

  const accessTokenEnc = encryptToken(EVO_KEY)

  // 1. Espelha eventual legado em whatsapp_instances
  await ensureLegacyWhatsappMirrored({
    organizationId,
    userId,
    evoUrl: EVO_URL,
  })

  // 2. Verifica uso atual e limite do plano
  const activeCount = await prisma.whatsappInstance.count({
    where: {
      organizationId,
      isActive: true,
    },
  })

  const limitCheck = await checkWhatsappInstanceLimit(organizationId, activeCount)
  if (!limitCheck.allowed) return limitCheck.errorResponse!

  const label = sanitizeLabel(body.label, `WhatsApp ${activeCount + 1}`)

  // 3. Gera nome único
  let instanceName = ''
  let created = false

  for (let attempt = 0; attempt < 3; attempt++) {
    instanceName = buildInstanceName(org.slug)

    const state = await getInstanceState(instanceName)
    if (state !== 'not_found') continue

    created = await createInstance(instanceName)
    if (created) break
  }

  if (!created || !instanceName) {
    return NextResponse.json(
      { error: 'Erro ao criar instância WhatsApp. Tente novamente.' },
      { status: 502 }
    )
  }

  // 4. Chatwoot automático
  const chatwootInboxId = await tryChatwootSetup({
    organizationId,
    orgSlug: org.slug,
    instanceName,
    evoUrl: EVO_URL,
    evoKey: EVO_KEY,
    phoneNumber: null,
  })

  // 5. Salva nova instância
  const whatsappInstance = await prisma.whatsappInstance.create({
    data: {
      organizationId,
      connectedById: userId,
      label,
      instanceName,
      phoneNumber: null,
      status: 'connecting',
      chatwootInboxId,
      serverUrl: EVO_URL,
      metadata: JSON.stringify({
        label,
        instanceName,
        serverUrl: EVO_URL,
        phone: null,
        connectedAt: null,
        chatwootInboxId,
      }),
      isActive: true,
      connectedAt: null,
    },
  })

  // 6. Atualiza sombra compatível
  await syncLegacyWhatsappShadow({
    organizationId,
    userId,
    accessTokenEnc,
    evoUrl: EVO_URL,
  })

  return NextResponse.json({
    success: true,
    alreadyExists: false,
    instanceId: whatsappInstance.id,
    instanceName: whatsappInstance.instanceName,
    label: whatsappInstance.label,
    chatwootInboxId,
    usage: limitCheck.usage
      ? {
          current: activeCount + 1,
          max: limitCheck.usage.max,
        }
      : undefined,
  })
}