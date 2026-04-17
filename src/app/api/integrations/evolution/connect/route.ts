/**
 * src/app/api/integrations/evolution/connect/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { checkPlanActive, checkWhatsappInstanceLimit } from '@/lib/checkLimits'
import { prisma } from '@/lib/prisma'
import {
  connectWhatsappChannel,
  ensureLegacyWhatsappMirrored,
  ChannelLifecycleError,
  sanitizeWhatsappLabel,
} from '@/lib/atendimento/orchestration/channel-lifecycle'

type ConnectBody = {
  label?: string
}

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

  await ensureLegacyWhatsappMirrored({
    organizationId,
    userId,
    evoUrl: EVO_URL,
  })

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
    const result = await connectWhatsappChannel({
      organizationId,
      userId,
      label,
      evoUrl: EVO_URL,
      evoKey: EVO_KEY,
    })

    return NextResponse.json({
      ...result,
      usage: limitCheck.usage
        ? {
            current: activeCount + 1,
            max: limitCheck.usage.max,
          }
        : undefined,
    })
  } catch (error) {
    if (error instanceof ChannelLifecycleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao criar instância WhatsApp. Tente novamente.' },
      { status: 502 }
    )
  }
}