import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

const EVO_URL = process.env.EVOLUTION_API_URL!.replace(/\/$/, '')
const EVO_KEY = process.env.EVOLUTION_API_KEY!

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  // ── Busca org para pegar slug e limite ──────────────────────────────────────
  const org = await prisma.organization.findUnique({
    where:  { id: organizationId },
    select: { slug: true, maxWhatsappInstances: true },
  })
  if (!org) return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })

  const instanceName = `org-${org.slug}`

  // ── Verifica se já existe conta ativa ───────────────────────────────────────
  const existing = await prisma.connectedAccount.findUnique({
    where: { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { isActive: true, data: true },
  })

  // Se já existe e está ativa, apenas retorna QR (reusa instância)
  if (existing?.isActive) {
    const data = JSON.parse(existing.data) as { instanceName: string }
    return NextResponse.json({ instanceName: data.instanceName, alreadyExists: true })
  }

  // ── Cria instância na Evolution API ─────────────────────────────────────────
  try {
    const createRes = await fetch(`${EVO_URL}/instance/create`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVO_KEY,
      },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode:      true,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    // 409 = instância já existe na Evolution (criada antes) — tudo bem, continua
    if (!createRes.ok && createRes.status !== 409) {
      const err = await createRes.text()
      console.error('[EVO CREATE]', err)
      return NextResponse.json(
        { error: 'Erro ao criar instância WhatsApp. Tente novamente.' },
        { status: 502 }
      )
    }

    // ── Salva no banco ───────────────────────────────────────────────────────
    // Usa token placeholder — a apiKey real da instância é a global (EVO_KEY)
    const accessTokenEnc = encryptToken(EVO_KEY)

    await prisma.connectedAccount.upsert({
      where: { provider_organizationId: { provider: 'whatsapp', organizationId } },
      create: {
        provider:      'whatsapp',
        organizationId,
        connectedById: session!.user.id,
        accessTokenEnc,
        isActive:      true,
        data: JSON.stringify({
          instanceName,
          serverUrl: EVO_URL,
          phone: null,
          connectedAt: null,
        }),
      },
      update: {
        isActive:   true,
        lastError:  null,
        data: JSON.stringify({
          instanceName,
          serverUrl: EVO_URL,
          phone: null,
          connectedAt: null,
        }),
      },
    })

    return NextResponse.json({ instanceName, alreadyExists: false })

  } catch (err) {
    console.error('[EVO CONNECT]', err)
    return NextResponse.json(
      { error: 'Não foi possível conectar ao servidor WhatsApp.' },
      { status: 502 }
    )
  }
}
