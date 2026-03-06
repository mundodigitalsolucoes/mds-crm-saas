/**
 * src/app/api/integrations/evolution/connect/route.ts
 *
 * Inicia conexão WhatsApp para a organização.
 * Usa evolutionClient centralizado — nunca chama a Evolution diretamente.
 *
 * Fluxo:
 *  1. Verifica se já existe outra instância ativa → bloqueia (regra: 1 número por org)
 *  2. Verifica estado atual na Evolution
 *  3a. Já online         → retorna alreadyExists=true
 *  3b. Offline/pendente  → tenta restart, cai para delete+create se falhar
 *  3c. Não existe        → cria instância nova
 *  4. Configura Chatwoot automaticamente (não bloqueia em caso de falha)
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'
import { setupChatwootEvolution } from '@/lib/integrations/chatwoot-evo'
import {
  getInstanceState,
  createInstance,
  restartInstance,
  disconnectInstance,
} from '@/lib/integrations/evolutionClient'

// ─── Helpers locais ───────────────────────────────────────────────────────────

async function upsertWhatsappAccount(params: {
  organizationId:  string
  userId:          string
  accessTokenEnc:  string
  instanceName:    string
  evoUrl:          string
  chatwootInboxId: number | null
  phone:           string | null
}) {
  const { organizationId, userId, accessTokenEnc, instanceName, evoUrl, chatwootInboxId, phone } = params

  const data = JSON.stringify({
    instanceName,
    serverUrl:       evoUrl,
    phone:           phone ?? null,
    connectedAt:     null,
    chatwootInboxId: chatwootInboxId ?? null,
  })

  await prisma.connectedAccount.upsert({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
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
      console.log('[Connect] Chatwoot configurado. InboxId:', result.chatwootInboxId)
    }
    return result.chatwootInboxId
  } catch (err) {
    console.error('[Connect] Erro no setup Chatwoot (ignorado):', err)
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''
  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json({ error: 'Servidor WhatsApp não configurado.' }, { status: 500 })
  }

  const organizationId = session!.user.organizationId

  const org = await prisma.organization.findUnique({
    where:  { id: organizationId },
    select: { slug: true, chatwootAccountId: true },
  })
  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
  }

  const instanceName   = `org-${org.slug}`
  const accessTokenEnc = encryptToken(EVO_KEY)

  // ── Busca dados existentes do WhatsApp ──────────────────────────────────────
  const existingWa = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { data: true, isActive: true },
  })
  const existingData     = existingWa ? (JSON.parse(existingWa.data) as { chatwootInboxId?: number | null; phone?: string | null; instanceName?: string }) : null
  const existingInboxId  = existingData?.chatwootInboxId ?? null
  const existingPhone    = existingData?.phone ?? null
  const existingInstance = existingData?.instanceName ?? null

  // ── REGRA: bloqueia 2º número se já existe instância ativa com nome diferente ─
  if (existingWa?.isActive && existingInstance && existingInstance !== instanceName) {
    return NextResponse.json(
      { error: 'Já existe um número WhatsApp conectado. Desconecte o número atual antes de conectar outro.' },
      { status: 409 }
    )
  }

  // ── Verifica estado real na Evolution ────────────────────────────────────────
  const state = await getInstanceState(instanceName)

  if (state === 'open') {
    // Caso 1: já conectado
    const chatwootInboxId = existingInboxId ?? await tryChatwootSetup({
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

  if (state === 'close' || state === 'connecting') {
    // Caso 2: instância existe mas offline — tenta restart sempre
    const restarted = await restartInstance(instanceName)

    if (restarted) {
      await new Promise(r => setTimeout(r, 2_000))

      const chatwootInboxId = existingInboxId ?? await tryChatwootSetup({
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

    // Restart falhou → deleta e recria
    await disconnectInstance(instanceName)
    await new Promise(r => setTimeout(r, 1_500))
  }

  // Caso 3: cria instância nova (not_found ou restart falhou)
  const created = await createInstance(instanceName)
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