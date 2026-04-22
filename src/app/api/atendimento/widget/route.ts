import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

const hexColorSchema = z.string().trim().regex(/^#([0-9A-Fa-f]{6})$/, 'Cor inválida.')
const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário inválido.')

const scenarioKeys = ['default', 'atendimento', 'consultoria', 'whatsapp', 'contato'] as const

type ScenarioKey = (typeof scenarioKeys)[number]

type BusinessDay = {
  enabled: boolean
  start: string
  end: string
}

type BusinessHours = Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  BusinessDay
>

type ScenarioTarget = {
  label: string
  url: string
}

type ScenarioTargets = Record<ScenarioKey, ScenarioTarget>

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

const scenarioTargetSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().max(300),
})

const scenarioTargetsSchema = z.object({
  default: scenarioTargetSchema,
  atendimento: scenarioTargetSchema,
  consultoria: scenarioTargetSchema,
  whatsapp: scenarioTargetSchema,
  contato: scenarioTargetSchema,
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
  scenarioTargets: scenarioTargetsSchema,
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
  scenarioTargets: {
    default: {
      label: 'Abrir Atendimento',
      url: 'https://crm.mundodigitalsolucoes.com.br',
    },
    atendimento: {
      label: 'Abrir Atendimento',
      url: 'https://crm.mundodigitalsolucoes.com.br',
    },
    consultoria: {
      label: 'Solicitar consultoria',
      url: 'https://mundodigitalsolucoes.com.br/contato',
    },
    whatsapp: {
      label: 'Falar no WhatsApp',
      url: 'https://wa.me/5517992822597',
    },
    contato: {
      label: 'Abrir página de contato',
      url: 'https://mundodigitalsolucoes.com.br/contato',
    },
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

function readString(
  raw: Record<string, unknown> | null,
  key: string,
  fallback: string
) {
  const value = raw?.[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function readBoolean(
  raw: Record<string, unknown> | null,
  key: string,
  fallback: boolean
) {
  const value = raw?.[key]
  return typeof value === 'boolean' ? value : fallback
}

function readEnum<T extends readonly string[]>(
  raw: Record<string, unknown> | null,
  key: string,
  allowed: T,
  fallback: T[number]
): T[number] {
  const value = raw?.[key]
  return typeof value === 'string' && allowed.includes(value as T[number])
    ? (value as T[number])
    : fallback
}

function normalizeBusinessHours(raw: unknown): BusinessHours {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const result = {} as BusinessHours

  for (const day of Object.keys(DEFAULT_WIDGET_CONFIG.businessHours) as Array<
    keyof BusinessHours
  >) {
    const defaultDay = DEFAULT_WIDGET_CONFIG.businessHours[day]
    const rawDay =
      source[day] && typeof source[day] === 'object'
        ? (source[day] as Record<string, unknown>)
        : null

    result[day] = {
      enabled:
        typeof rawDay?.enabled === 'boolean' ? rawDay.enabled : defaultDay.enabled,
      start:
        typeof rawDay?.start === 'string' && timeSchema.safeParse(rawDay.start).success
          ? rawDay.start
          : defaultDay.start,
      end:
        typeof rawDay?.end === 'string' && timeSchema.safeParse(rawDay.end).success
          ? rawDay.end
          : defaultDay.end,
    }
  }

  return result
}

function normalizeScenarioTargets(params: {
  raw: unknown
  ctaLabel: string
  primaryActionUrl: string
}): ScenarioTargets {
  const source =
    params.raw && typeof params.raw === 'object'
      ? (params.raw as Record<string, unknown>)
      : {}

  const defaults: ScenarioTargets = {
    ...DEFAULT_WIDGET_CONFIG.scenarioTargets,
    default: {
      label: params.ctaLabel,
      url: params.primaryActionUrl,
    },
  }

  const result = {} as ScenarioTargets

  for (const key of scenarioKeys) {
    const defaultTarget = defaults[key]
    const rawTarget =
      source[key] && typeof source[key] === 'object'
        ? (source[key] as Record<string, unknown>)
        : null

    result[key] = {
      label:
        typeof rawTarget?.label === 'string' && rawTarget.label.trim()
          ? rawTarget.label
          : defaultTarget.label,
      url:
        typeof rawTarget?.url === 'string'
          ? rawTarget.url
          : defaultTarget.url,
    }
  }

  return result
}

function resolveWidgetConfigFromSettings(
  rawSettings: Record<string, unknown> | null,
  fallbackOrganizationName?: string
): WidgetConfig {
  const widgetRaw =
    rawSettings && typeof rawSettings.atendimentoWidget === 'object'
      ? (rawSettings.atendimentoWidget as Record<string, unknown>)
      : null

  const organizationName = readString(
    widgetRaw,
    'organizationName',
    fallbackOrganizationName?.trim() || DEFAULT_WIDGET_CONFIG.organizationName
  )

  const ctaLabel = readString(widgetRaw, 'ctaLabel', DEFAULT_WIDGET_CONFIG.ctaLabel)
  const primaryActionUrl = readString(
    widgetRaw,
    'primaryActionUrl',
    DEFAULT_WIDGET_CONFIG.primaryActionUrl
  )

  const merged: WidgetConfig = {
    organizationName,
    title: readString(widgetRaw, 'title', DEFAULT_WIDGET_CONFIG.title),
    subtitle: readString(widgetRaw, 'subtitle', DEFAULT_WIDGET_CONFIG.subtitle),
    ctaLabel,
    online: readBoolean(widgetRaw, 'online', DEFAULT_WIDGET_CONFIG.online),
    position: readEnum(
      widgetRaw,
      'position',
      ['right', 'left'] as const,
      DEFAULT_WIDGET_CONFIG.position
    ),
    buttonLabel: readString(
      widgetRaw,
      'buttonLabel',
      DEFAULT_WIDGET_CONFIG.buttonLabel
    ),
    primaryActionUrl,
    primaryColor: readString(
      widgetRaw,
      'primaryColor',
      DEFAULT_WIDGET_CONFIG.primaryColor
    ),
    accentColor: readString(
      widgetRaw,
      'accentColor',
      DEFAULT_WIDGET_CONFIG.accentColor
    ),
    operatingMode: readEnum(
      widgetRaw,
      'operatingMode',
      ['manual', 'business_hours'] as const,
      DEFAULT_WIDGET_CONFIG.operatingMode
    ),
    timezone: readString(widgetRaw, 'timezone', DEFAULT_WIDGET_CONFIG.timezone),
    fallbackBehavior: readEnum(
      widgetRaw,
      'fallbackBehavior',
      ['none', 'redirect'] as const,
      DEFAULT_WIDGET_CONFIG.fallbackBehavior
    ),
    fallbackLabel: readString(
      widgetRaw,
      'fallbackLabel',
      DEFAULT_WIDGET_CONFIG.fallbackLabel
    ),
    fallbackUrl:
      typeof widgetRaw?.fallbackUrl === 'string'
        ? widgetRaw.fallbackUrl
        : DEFAULT_WIDGET_CONFIG.fallbackUrl,
    businessHours: normalizeBusinessHours(widgetRaw?.businessHours),
    scenarioTargets: normalizeScenarioTargets({
      raw: widgetRaw?.scenarioTargets,
      ctaLabel,
      primaryActionUrl,
    }),
  }

  const parsed = widgetConfigSchema.safeParse(merged)
  if (parsed.success) return parsed.data

  return {
    ...DEFAULT_WIDGET_CONFIG,
    organizationName,
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