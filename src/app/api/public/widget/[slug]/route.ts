import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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

const publicWidgetConfigSchema = z.object({
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
  scenarioTargets: z.object({
    default: scenarioTargetSchema,
    atendimento: scenarioTargetSchema,
    consultoria: scenarioTargetSchema,
    whatsapp: scenarioTargetSchema,
    contato: scenarioTargetSchema,
  }),
})

const DEFAULTS = {
  ctaLabel: 'Abrir Atendimento',
  primaryActionUrl: 'https://crm.mundodigitalsolucoes.com.br',
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

  const defaults: BusinessHours = {
    monday: { enabled: true, start: '08:00', end: '18:00' },
    tuesday: { enabled: true, start: '08:00', end: '18:00' },
    wednesday: { enabled: true, start: '08:00', end: '18:00' },
    thursday: { enabled: true, start: '08:00', end: '18:00' },
    friday: { enabled: true, start: '08:00', end: '18:00' },
    saturday: { enabled: false, start: '08:00', end: '12:00' },
    sunday: { enabled: false, start: '08:00', end: '12:00' },
  }

  const result = {} as BusinessHours

  for (const day of Object.keys(defaults) as Array<keyof BusinessHours>) {
    const defaultDay = defaults[day]
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
    ...DEFAULTS.scenarioTargets,
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const organization = await prisma.organization.findFirst({
    where: {
      slug,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      settings: true,
      updatedAt: true,
    },
  })

  if (!organization) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      {
        status: 404,
        headers: corsHeaders(),
      }
    )
  }

  const parsedSettings =
    safeJsonParse<Record<string, unknown>>(organization.settings) ?? {}

  const widgetRaw =
    parsedSettings && typeof parsedSettings.atendimentoWidget === 'object'
      ? (parsedSettings.atendimentoWidget as Record<string, unknown>)
      : null

  const ctaLabel = readString(widgetRaw, 'ctaLabel', DEFAULTS.ctaLabel)
  const primaryActionUrl = readString(
    widgetRaw,
    'primaryActionUrl',
    DEFAULTS.primaryActionUrl
  )

  const merged = {
    organizationName: readString(widgetRaw, 'organizationName', organization.name),
    title: readString(widgetRaw, 'title', 'Fale com nosso Atendimento'),
    subtitle: readString(
      widgetRaw,
      'subtitle',
      'Tire dúvidas, peça suporte ou inicie seu atendimento comercial por este canal.'
    ),
    ctaLabel,
    online: readBoolean(widgetRaw, 'online', true),
    position: readEnum(widgetRaw, 'position', ['right', 'left'] as const, 'right'),
    buttonLabel: readString(widgetRaw, 'buttonLabel', 'Atendimento'),
    primaryActionUrl,
    primaryColor: readString(widgetRaw, 'primaryColor', '#374b89'),
    accentColor: readString(widgetRaw, 'accentColor', '#2f3453'),
    operatingMode: readEnum(
      widgetRaw,
      'operatingMode',
      ['manual', 'business_hours'] as const,
      'manual'
    ),
    timezone: readString(widgetRaw, 'timezone', 'America/Sao_Paulo'),
    fallbackBehavior: readEnum(
      widgetRaw,
      'fallbackBehavior',
      ['none', 'redirect'] as const,
      'none'
    ),
    fallbackLabel: readString(widgetRaw, 'fallbackLabel', 'Abrir opção alternativa'),
    fallbackUrl:
      typeof widgetRaw?.fallbackUrl === 'string' ? widgetRaw.fallbackUrl : '',
    businessHours: normalizeBusinessHours(widgetRaw?.businessHours),
    scenarioTargets: normalizeScenarioTargets({
      raw: widgetRaw?.scenarioTargets,
      ctaLabel,
      primaryActionUrl,
    }),
  }

  const parsedWidget = publicWidgetConfigSchema.safeParse(merged)

  if (!parsedWidget.success) {
    return NextResponse.json(
      { error: 'Widget não configurado para esta organização.' },
      {
        status: 404,
        headers: corsHeaders(),
      }
    )
  }

  return NextResponse.json(
    {
      orgScope: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      config: parsedWidget.data,
      savedAt: organization.updatedAt.toISOString(),
    },
    {
      headers: corsHeaders(),
    }
  )
}