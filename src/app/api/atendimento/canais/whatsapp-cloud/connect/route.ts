import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { checkPlanActive, checkWhatsappInstanceLimit } from '@/lib/checkLimits'
import { prisma } from '@/lib/prisma'
import { sanitizeWhatsappLabel } from '@/lib/atendimento/orchestration/channel-lifecycle'
import { connectWhatsappCloudOfficial } from '@/lib/atendimento/providers/whatsapp-cloud-connect'

const bodySchema = z.object({
  label: z.string().optional(),
  phoneNumber: z.string().min(8, 'Informe o número do WhatsApp.'),
  phoneNumberId: z.string().min(5, 'Informe o Phone Number ID.'),
  businessAccountId: z.string().min(5, 'Informe o Business Account ID.'),
  accessToken: z.string().min(20, 'Informe o Access Token da Meta.'),
})

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const userId = session!.user.id

  const planCheck = await checkPlanActive(organizationId)
  if (!planCheck.active) return planCheck.errorResponse!

  const activeCount = await prisma.whatsappInstance.count({
    where: {
      organizationId,
      isActive: true,
      NOT: { status: 'archived' },
    },
  })

  const limitCheck = await checkWhatsappInstanceLimit(organizationId, activeCount)
  if (!limitCheck.allowed) return limitCheck.errorResponse!

  const rawBody = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      },
      { status: 400 }
    )
  }

  const label = sanitizeWhatsappLabel(
    parsed.data.label,
    `WhatsApp API Oficial ${activeCount + 1}`
  )

  try {
    const result = await connectWhatsappCloudOfficial({
      organizationId,
      userId,
      label,
      phoneNumber: parsed.data.phoneNumber,
      phoneNumberId: parsed.data.phoneNumberId,
      businessAccountId: parsed.data.businessAccountId,
      accessToken: parsed.data.accessToken,
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao configurar WhatsApp API Oficial.',
      },
      { status: 502 }
    )
  }
}