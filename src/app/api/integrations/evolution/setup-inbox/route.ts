// src/app/api/integrations/evolution/setup-inbox/route.ts
/**
 * Endpoint para reconfigurar inbox Chatwoot manualmente
 * Útil se o setup automático falhou ou Chatwoot foi configurado depois do WhatsApp
 */
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { setupChatwootEvolution } from '@/lib/integrations/chatwoot-evo'

function getEvoConfig() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
  return { EVO_URL: url.replace(/\/$/, ''), EVO_KEY: key }
}

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const { EVO_URL, EVO_KEY } = getEvoConfig()

  // Busca org e conta WhatsApp
  const [org, waAccount] = await Promise.all([
    prisma.organization.findUnique({
      where:  { id: organizationId },
      select: { slug: true },
    }),
    prisma.connectedAccount.findUnique({
      where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
      select: { data: true, isActive: true },
    }),
  ])

  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
  }

  if (!waAccount?.isActive) {
    return NextResponse.json(
      { error: 'WhatsApp não está conectado. Conecte primeiro.' },
      { status: 400 }
    )
  }

  const waData = JSON.parse(waAccount.data) as {
    instanceName: string
    phone: string | null
    chatwootInboxId: number | null
  }

  const result = await setupChatwootEvolution({
    organizationId,
    orgSlug:      org.slug,
    instanceName: waData.instanceName,
    evoUrl:       EVO_URL,
    evoKey:       EVO_KEY,
    phoneNumber:  waData.phone ?? null,
  })

  if (result.skipped) {
    return NextResponse.json(
      { error: 'Chatwoot não está configurado. Configure primeiro em Integrações.' },
      { status: 400 }
    )
  }

  if (!result.success && !result.chatwootInboxId) {
    return NextResponse.json(
      { error: 'Falha ao configurar inbox no Chatwoot. Verifique as credenciais.' },
      { status: 502 }
    )
  }

  // Atualiza chatwootInboxId no banco
  await prisma.connectedAccount.updateMany({
    where: { provider: 'whatsapp', organizationId },
    data: {
      data: JSON.stringify({
        ...waData,
        chatwootInboxId: result.chatwootInboxId,
      }),
    },
  })

  return NextResponse.json({
    success:         true,
    chatwootInboxId: result.chatwootInboxId,
    webhookConfigured: result.success,
  })
}
