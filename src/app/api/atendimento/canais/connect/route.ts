// src/app/api/atendimento/canais/connect/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { checkPlanActive, checkWhatsappInstanceLimit } from '@/lib/checkLimits'
import { prisma } from '@/lib/prisma'
import {
  ChannelLifecycleError,
  ensureLegacyWhatsappMirrored,
  sanitizeWhatsappLabel,
} from '@/lib/atendimento/orchestration/channel-lifecycle'
import { connectWhatsappByProvider, resolveRequestedWhatsappProvider } from '@/lib/atendimento/providers'
import { getWhatsappProviderDefinition } from '@/lib/atendimento/providers/types'

type ConnectBody = {
  label?: string
  provider?: string
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''

  const organizationId = session!.user.organizationId
  const userId = session!.user.id

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      maxWhatsappInstances: true,
    },
  })

  if (!organization) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      { status: 404 }
    )
  }

  const planCheck = await checkPlanActive(organizationId)
  if (!planCheck.active) return planCheck.errorResponse!

  const body = await req.json().catch(() => ({} as ConnectBody))
  const provider = resolveRequestedWhatsappProvider(body.provider)
  const providerDef = getWhatsappProviderDefinition(provider)

  if (provider === 'evolution') {
    await ensureLegacyWhatsappMirrored({
      organizationId,
      userId,
      evoUrl: EVO_URL,
    })
  }

  const activeCount = await prisma.whatsappInstance.count({
    where: {
      organizationId,
      isActive: true,
      NOT: { status: 'archived' },
    },
  })

  const limitCheck = await checkWhatsappInstanceLimit(organizationId, activeCount)
  if (!limitCheck.allowed) return limitCheck.errorResponse!

  const label = sanitizeWhatsappLabel(body.label, `WA ${activeCount + 1}`)

  try {
    const result = await connectWhatsappByProvider({
      provider,
      organizationId,
      userId,
      label,
      evoUrl: EVO_URL,
      evoKey: EVO_KEY,
    })

    return NextResponse.json({
      ...result,
      provider,
      providerTitle: providerDef.title,
      orgScope: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
      },
      usage: limitCheck.usage
        ? {
            current: activeCount + (providerDef.safeToUseNow ? 1 : 0),
            max: limitCheck.usage.max,
          }
        : undefined,
    })
  } catch (error) {
    if (error instanceof ChannelLifecycleError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          provider,
          orgScope: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            plan: organization.plan,
          },
        },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        error: 'Erro ao iniciar o canal WhatsApp.',
        provider,
        orgScope: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
        },
      },
      { status: 502 }
    )
  }
}