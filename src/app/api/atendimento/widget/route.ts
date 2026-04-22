import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

const hexColorSchema = z.string().trim().regex(/^#([0-9A-Fa-f]{6})$/, 'Cor inválida.')

const widgetConfigSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(400),
  ctaLabel: z.string().trim().min(1).max(80),
  online: z.boolean(),
  position: z.enum(['right', 'left']),
  buttonLabel: z.string().trim().min(1).max(80),
  primaryActionUrl: z.string().trim().url().max(300),
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
})

type WidgetConfig = z.infer<typeof widgetConfigSchema>

const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  organizationName: 'Mundo Digital Soluções',
  title: 'Fale com nosso Atendimento',
  subtitle:
    'Tire dúvidas, peça suporte ou inicie seu atendimento comercial por este canal.',
  ctaLabel: 'Abrir Atendimento',
  online: true,
  position: 'right',
  buttonLabel: 'Atendimento',
  primaryActionUrl: 'https://crm.mundodigitalsolucoes.com.br',
  primaryColor: '#374b89',
  accentColor: '#2f3453',
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function resolveWidgetConfigFromSettings(
  rawSettings: Record<string, unknown> | null,
  fallbackOrganizationName?: string
): WidgetConfig {
  const widgetRaw =
    rawSettings && typeof rawSettings.atendimentoWidget === 'object'
      ? rawSettings.atendimentoWidget
      : null

  const parsed = widgetConfigSchema.safeParse(widgetRaw)

  if (parsed.success) {
    return parsed.data
  }

  return {
    ...DEFAULT_WIDGET_CONFIG,
    organizationName:
      fallbackOrganizationName?.trim() || DEFAULT_WIDGET_CONFIG.organizationName,
  }
}

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      settings: true,
      updatedAt: true,
    },
  })

  if (!organization) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      { status: 404 }
    )
  }

  const parsedSettings =
    safeJsonParse<Record<string, unknown>>(organization.settings) ?? {}

  const config = resolveWidgetConfigFromSettings(parsedSettings, organization.name)

  return NextResponse.json({
    orgScope: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
    },
    config,
    defaults: {
      ...DEFAULT_WIDGET_CONFIG,
      organizationName: organization.name || DEFAULT_WIDGET_CONFIG.organizationName,
    },
    savedAt: organization.updatedAt.toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const body = await req.json().catch(() => ({}))
  const parsed = widgetConfigSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Dados inválidos para salvar a configuração do widget.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      settings: true,
    },
  })

  if (!organization) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      { status: 404 }
    )
  }

  const parsedSettings =
    safeJsonParse<Record<string, unknown>>(organization.settings) ?? {}

  const nextSettings = {
    ...parsedSettings,
    atendimentoWidget: {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    },
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: JSON.stringify(nextSettings),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    success: true,
    orgScope: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
    },
    config: parsed.data,
    savedAt: updated.updatedAt.toISOString(),
  })
}