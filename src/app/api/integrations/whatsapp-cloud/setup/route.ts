import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

const setupSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  appId: z.string().trim().min(1).max(120),
  businessAccountId: z.string().trim().min(1).max(120),
  phoneNumberId: z.string().trim().min(1).max(120),
  verifyToken: z.string().trim().min(8).max(180),
  accessToken: z.string().trim().max(4000).optional().default(''),
})

type SetupPayload = z.infer<typeof setupSchema>

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const userId = session!.user.id

  const body = await req.json().catch(() => ({}))
  const parsed = setupSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Dados inválidos para configurar o WhatsApp Cloud API.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const payload: SetupPayload = parsed.data

  const existing = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: {
        provider: 'whatsapp_cloud',
        organizationId,
      },
    },
  })

  const previousData =
    safeJsonParse<Record<string, unknown>>(existing?.data) ?? {}

  const trimmedAccessToken = payload.accessToken.trim()
  const accessTokenEnc =
    trimmedAccessToken.length > 0
      ? encryptToken(trimmedAccessToken)
      : existing?.accessTokenEnc ?? ''

  if (!accessTokenEnc) {
    return NextResponse.json(
      {
        error: 'Access Token é obrigatório na primeira configuração do WhatsApp Cloud API.',
      },
      { status: 400 }
    )
  }

  const now = new Date()

  const nextData = JSON.stringify({
    ...previousData,
    provider: 'whatsapp_cloud',
    setupMode: 'manual',
    status: 'pending_validation',
    displayName: payload.displayName,
    appId: payload.appId,
    businessAccountId: payload.businessAccountId,
    phoneNumberId: payload.phoneNumberId,
    verifyToken: payload.verifyToken,
    configuredAt: previousData.configuredAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    disconnectedAt: null,
    validation: {
      success: false,
      message: 'Configuração salva. Valide as credenciais antes de prosseguir.',
      validatedAt: null,
      displayPhoneNumber: null,
      verifiedName: null,
    },
  })

  const account = await prisma.connectedAccount.upsert({
    where: {
      provider_organizationId: {
        provider: 'whatsapp_cloud',
        organizationId,
      },
    },
    create: {
      provider: 'whatsapp_cloud',
      organizationId,
      connectedById: userId,
      accessTokenEnc,
      data: nextData,
      isActive: true,
      lastError: null,
      lastSyncAt: now,
    },
    update: {
      connectedById: userId,
      accessTokenEnc,
      data: nextData,
      isActive: true,
      lastError: null,
      lastSyncAt: now,
    },
  })

  return NextResponse.json({
    success: true,
    provider: 'whatsapp_cloud',
    status: 'pending_validation',
    connectedAccountId: account.id,
    orgScope: {
      organizationId,
    },
  })
}

export async function DELETE() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const userId = session!.user.id

  const existing = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: {
        provider: 'whatsapp_cloud',
        organizationId,
      },
    },
  })

  if (!existing) {
    return NextResponse.json({
      success: true,
      provider: 'whatsapp_cloud',
      status: 'disconnected',
      orgScope: {
        organizationId,
      },
    })
  }

  const previousData =
    safeJsonParse<Record<string, unknown>>(existing.data) ?? {}

  const now = new Date()

  await prisma.connectedAccount.update({
    where: { id: existing.id },
    data: {
      connectedById: userId,
      isActive: false,
      lastError: null,
      lastSyncAt: now,
      data: JSON.stringify({
        ...previousData,
        provider: 'whatsapp_cloud',
        status: 'disconnected',
        disconnectedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        validation: {
          success: false,
          message: 'Configuração removida.',
          validatedAt: null,
          displayPhoneNumber: null,
          verifiedName: null,
        },
      }),
    },
  })

  return NextResponse.json({
    success: true,
    provider: 'whatsapp_cloud',
    status: 'disconnected',
    orgScope: {
      organizationId,
    },
  })
}