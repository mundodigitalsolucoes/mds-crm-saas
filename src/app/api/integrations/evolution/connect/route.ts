// src/app/api/integrations/evolution/connect/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'
import { setupChatwootEvolution } from '@/lib/integrations/chatwoot-evo'

function getEvoConfig() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
  return { EVO_URL: url.replace(/\/$/, ''), EVO_KEY: key }
}

async function deleteInstance(EVO_URL: string, EVO_KEY: string, instanceName: string) {
  try {
    await fetch(`${EVO_URL}/instance/logout/${instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
  } catch { /* silencioso */ }

  try {
    await fetch(`${EVO_URL}/instance/delete/${instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
  } catch { /* silencioso */ }
}

async function restartInstance(
  EVO_URL: string,
  EVO_KEY: string,
  instanceName: string
): Promise<boolean> {
  try {
    const res = await fetch(`${EVO_URL}/instance/restart/${instanceName}`, {
      method:  'PUT',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
    return res.ok
  } catch {
    return false
  }
}

async function createInstance(
  EVO_URL: string,
  EVO_KEY: string,
  instanceName: string
): Promise<boolean> {
  try {
    const res = await fetch(`${EVO_URL}/instance/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode:      true,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Salva ConnectedAccount WhatsApp com chatwootInboxId ─────────────────────

async function upsertWhatsappAccount(params: {
  organizationId:  string
  userId:          string
  accessTokenEnc:  string
  instanceName:    string
  evoUrl:          string
  chatwootInboxId: number | null
  phone:           string | null
}) {
  const {
    organizationId, userId, accessTokenEnc,
    instanceName, evoUrl, chatwootInboxId, phone,
  } = params

  const data = JSON.stringify({
    instanceName,
    serverUrl:       evoUrl,
    phone:           phone ?? null,
    connectedAt:     null,
    chatwootInboxId: chatwootInboxId ?? null,
  })

  await prisma.connectedAccount.upsert({
    where: {
      provider_organizationId: { provider: 'whatsapp', organizationId },
    },
    create: {
      provider:      'whatsapp',
      organizationId,
      connectedById: userId,
      accessTokenEnc,
      isActive:      true,
      data,
    },
    update: {
      accessTokenEnc,
      isActive:   true,
      lastError:  null,
      lastSyncAt: new Date(),
      data,
    },
  })
}

// ─── Tenta configurar Chatwoot (nunca bloqueia o fluxo principal) ─────────────

async function tryChatwootSetup(params: {
  organizationId: string
  orgSlug:        string
  instanceName:   string
  evoUrl:         string
  evoKey:         string
  phoneNumber:    string | null
}): Promise<number | null> {
  try {
    const result = await setupChatwootEvolution(params)
    if (result.skipped) {
      console.log('[Connect] Chatwoot não configurado, pulando setup.')
    } else if (!result.success) {
      console.warn('[Connect] Setup Chatwoot parcialmente falhou. InboxId:', result.chatwootInboxId)
    } else {
      console.log('[Connect] Chatwoot configurado com sucesso. InboxId:', result.chatwootInboxId)
    }
    return result.chatwootInboxId
  } catch (err) {
    console.error('[Connect] Erro inesperado no setup Chatwoot (ignorado):', err)
    return null
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const { EVO_URL, EVO_KEY } = getEvoConfig()
  const organizationId = session!.user.organizationId

  const org = await prisma.organization.findUnique({
    where:  { id: organizationId },
    select: { slug: true },
  })
  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
  }

  const instanceName   = `org-${org.slug}`
  const accessTokenEnc = encryptToken(EVO_KEY)

  // ── Verifica se Chatwoot está configurado (para decidir restart vs delete) ───
  const hasChatwoot = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { isActive: true },
  })
  const chatwootConfigured = hasChatwoot?.isActive === true

  // ── Busca chatwootInboxId já salvo (preserva se Chatwoot não mudar) ──────────
  const existingWa = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { data: true },
  })
  const existingData = existingWa
    ? (JSON.parse(existingWa.data) as { chatwootInboxId?: number | null; phone?: string | null })
    : null
  const existingInboxId = existingData?.chatwootInboxId ?? null
  const existingPhone   = existingData?.phone ?? null

  // ── Verifica estado real na Evolution ────────────────────────────────────────
  let instanceExistsAndOnline = false
  let instanceExistsOffline   = false

  try {
    const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })

    if (stateRes.ok) {
      const stateJson = await stateRes.json() as { instance?: { state?: string } }
      const state     = stateJson?.instance?.state

      if (state === 'open') {
        instanceExistsAndOnline = true
      } else {
        instanceExistsOffline = true
      }
    }
    // não ok → instância não existe
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível conectar ao servidor WhatsApp.' },
      { status: 502 }
    )
  }

  // ── Caso 1: já conectado ─────────────────────────────────────────────────────
  if (instanceExistsAndOnline) {
    const chatwootInboxId = existingInboxId
      ? existingInboxId
      : await tryChatwootSetup({
          organizationId,
          orgSlug:     org.slug,
          instanceName,
          evoUrl:      EVO_URL,
          evoKey:      EVO_KEY,
          phoneNumber: existingPhone,
        })

    await upsertWhatsappAccount({
      organizationId,
      userId:         session!.user.id,
      accessTokenEnc,
      instanceName,
      evoUrl:         EVO_URL,
      chatwootInboxId,
      phone:          existingPhone,
    })

    return NextResponse.json({ instanceName, alreadyExists: true })
  }

  // ── Caso 2: instância offline ────────────────────────────────────────────────
  if (instanceExistsOffline) {
    if (chatwootConfigured) {
      const restarted = await restartInstance(EVO_URL, EVO_KEY, instanceName)
      if (restarted) {
        await new Promise(r => setTimeout(r, 2_000))

        const chatwootInboxId = existingInboxId
          ? existingInboxId
          : await tryChatwootSetup({
              organizationId,
              orgSlug:     org.slug,
              instanceName,
              evoUrl:      EVO_URL,
              evoKey:      EVO_KEY,
              phoneNumber: existingPhone,
            })

        await upsertWhatsappAccount({
          organizationId,
          userId:         session!.user.id,
          accessTokenEnc,
          instanceName,
          evoUrl:         EVO_URL,
          chatwootInboxId,
          phone:          existingPhone,
        })

        return NextResponse.json({ instanceName, alreadyExists: false })
      }
      // restart falhou → cai para delete+create
    }

    await deleteInstance(EVO_URL, EVO_KEY, instanceName)
    await new Promise(r => setTimeout(r, 1_500))
  }

  // ── Caso 3: cria instância nova ──────────────────────────────────────────────
  const created = await createInstance(EVO_URL, EVO_KEY, instanceName)
  if (!created) {
    return NextResponse.json(
      { error: 'Erro ao criar instância WhatsApp. Tente novamente.' },
      { status: 502 }
    )
  }

  const chatwootInboxId = await tryChatwootSetup({
    organizationId,
    orgSlug:     org.slug,
    instanceName,
    evoUrl:      EVO_URL,
    evoKey:      EVO_KEY,
    phoneNumber: null,
  })

  await upsertWhatsappAccount({
    organizationId,
    userId:         session!.user.id,
    accessTokenEnc,
    instanceName,
    evoUrl:         EVO_URL,
    chatwootInboxId,
    phone:          null,
  })

  return NextResponse.json({ instanceName, alreadyExists: false })
}
