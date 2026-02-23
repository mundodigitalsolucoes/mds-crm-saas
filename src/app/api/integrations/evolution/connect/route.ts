import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

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

async function restartInstance(EVO_URL: string, EVO_KEY: string, instanceName: string): Promise<boolean> {
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

async function createInstance(EVO_URL: string, EVO_KEY: string, instanceName: string): Promise<boolean> {
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
  const upsertData     = {
    instanceName,
    serverUrl:   EVO_URL,
    phone:       null,
    connectedAt: null,
  }

  // ── Verifica se Chatwoot já está configurado para esta instância ─────────────
  // Se sim, preferimos restart em vez de delete+create (preserva webhook do Chatwoot)
  const hasChatwoot = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { isActive: true },
  })
  const chatwootConfigured = hasChatwoot?.isActive === true

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
    // não ok → instância não existe na Evolution
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível conectar ao servidor WhatsApp.' },
      { status: 502 }
    )
  }

  // ── Caso 1: já conectado — garante banco e retorna ───────────────────────────
  if (instanceExistsAndOnline) {
    await prisma.connectedAccount.upsert({
      where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
      create: {
        provider:      'whatsapp',
        organizationId,
        connectedById: session!.user.id,
        accessTokenEnc,
        isActive:      true,
        data: JSON.stringify(upsertData),
      },
      update: {
        isActive:   true,
        lastError:  null,
        lastSyncAt: new Date(),
        data: JSON.stringify(upsertData),
      },
    })
    return NextResponse.json({ instanceName, alreadyExists: true })
  }

  // ── Caso 2: instância offline ────────────────────────────────────────────────
  if (instanceExistsOffline) {
    if (chatwootConfigured) {
      // ✅ Chatwoot configurado → restart preserva webhook e inbox
      const restarted = await restartInstance(EVO_URL, EVO_KEY, instanceName)
      if (restarted) {
        await new Promise(r => setTimeout(r, 2_000))

        await prisma.connectedAccount.upsert({
          where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
          create: {
            provider:      'whatsapp',
            organizationId,
            connectedById: session!.user.id,
            accessTokenEnc,
            isActive:      true,
            data: JSON.stringify(upsertData),
          },
          update: {
            isActive:   true,
            lastError:  null,
            lastSyncAt: new Date(),
            data: JSON.stringify(upsertData),
          },
        })
        // Retorna instanceName para o frontend abrir o modal QR
        return NextResponse.json({ instanceName, alreadyExists: false })
      }
      // restart falhou → cai para delete+create abaixo
    }

    // Sem Chatwoot configurado (ou restart falhou) → delete + create
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

  await prisma.connectedAccount.upsert({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    create: {
      provider:      'whatsapp',
      organizationId,
      connectedById: session!.user.id,
      accessTokenEnc,
      isActive:      true,
      data: JSON.stringify(upsertData),
    },
    update: {
      accessTokenEnc,
      isActive:   true,
      lastError:  null,
      lastSyncAt: new Date(),
      data: JSON.stringify(upsertData),
    },
  })

  return NextResponse.json({ instanceName, alreadyExists: false })
}
