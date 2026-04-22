import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

const hexColorSchema = z.string().trim().regex(/^#([0-9A-Fa-f]{6})$/, 'Cor inválida.')
const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário inválido.')

const businessDaySchema = z.object({
  enabled: z.boolean(),
  start: timeSchema,
  end: timeSchema,
})

const businessHoursSchema = z.object({
  monday: businessDaySchema,
  tuesday: businessDaySchema,
  wednesday: businessDaySchema,
  thursday: businessDaySchema,
  friday: businessDaySchema,
  saturday: businessDaySchema,
  sunday: businessDaySchema,
})

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
  operatingMode: z.enum(['manual', 'business_hours']),
  timezone: z.string().trim().min(1).max(80),
  fallbackBehavior: z.enum(['none', 'redirect']),
  fallbackLabel: z.string().trim().max(80),
  fallbackUrl: z.string().trim().max(300),
  businessHours: businessHoursSchema,
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
  operatingMode: 'manual',
  timezone: 'America/Sao_Paulo',
  fallbackBehavior: 'none',
  fallbackLabel: 'Abrir opção alternativa',
  fallbackUrl: '',
  businessHours: {
    monday: { enabled: true, start: '08:00', end: '18:00' },
    tuesday: { enabled: true, start: '08:00', end: '18:00' },
    wednesday: { enabled: true, start: '08:00', end: '18:00' },
    thursday: { enabled: true, start: '08:00', end: '18:00' },
    friday: { enabled: true, start: '08:00', end: '18:00' },
    saturday: { enabled: false, start: '08:00', end: '12:00' },
    sunday: { enabled: false, start: '08:00', end: '12:00' },
  },
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