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

  const org = await prisma.organization.findUnique({
    where:  { id: organizationId },
    select: { slug: true, maxWhatsappInstances: true },
  })
  if (!org) return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })

  const instanceName = `org-${org.slug}`

  // Se já existe conta ativa no banco → reusa
  const existing = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { isActive: true, data: true },
  })

  if (existing?.isActive) {
    const data = JSON.parse(existing.data) as { instanceName: string }
    return NextResponse.json({ instanceName: data.instanceName, alreadyExists: true })
  }

  // ── Verifica se instância já existe na Evolution API ──────────────────────
  try {
    const checkRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })

    const accessTokenEnc = encryptToken(EVO_KEY)
    const upsertData = {
      instanceName,
      serverUrl:   EVO_URL,
      phone:       null,
      connectedAt: null,
    }

    if (checkRes.ok) {
      // Instância já existe na Evolution → só vincula no banco
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
          isActive:  true,
          lastError: null,
          data: JSON.stringify(upsertData),
        },
      })
      return NextResponse.json({ instanceName, alreadyExists: true })
    }

    // Instância não existe → criar
    const createRes = await fetch(`${EVO_URL}/instance/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode:      true,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      console.error('[EVO CREATE]', createRes.status, err)
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
        isActive:  true,
        lastError: null,
        data: JSON.stringify(upsertData),
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
