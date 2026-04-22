import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

const hexColorSchema = z.string().trim().regex(/^#([0-9A-Fa-f]{6})$/, 'Cor inválida.')
const domainSchema = z.string().trim().min(1).max(200)
const localeSchema = z.string().trim().min(2).max(20)

const widgetConfigSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),

  enabled: z.boolean(),

  chatwootBaseUrl: z.string().trim().url().max(300),
  websiteToken: z.string().trim().max(200),
  websiteInboxName: z.string().trim().min(1).max(120),
  websiteDomain: z.string().trim().min(1).max(200),

  widgetColor: hexColorSchema,
  welcomeTitle: z.string().trim().min(1).max(120),
  welcomeTagline: z.string().trim().min(1).max(400),

  position: z.enum(['left', 'right']),
  locale: localeSchema,
  useBrowserLanguage: z.boolean(),
  darkMode: z.enum(['light', 'auto']),
  launcherType: z.enum(['standard', 'expanded']),
  launcherTitle: z.string().trim().max(80),

  greetingEnabled: z.boolean(),
  greetingMessage: z.string().trim().max(400),

  publishMode: z.enum(['all', 'allowlist']),
  allowedDomains: z.array(domainSchema).max(20),

  notes: z.string().trim().max(500),
})

type WidgetConfig = z.infer<typeof widgetConfigSchema>

const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  organizationName: 'Mundo Digital Soluções',

  enabled: false,

  chatwootBaseUrl: 'https://app.mundodigitalsolucoes.com.br',
  websiteToken: '',
  websiteInboxName: 'Website',
  websiteDomain: 'www.exemplo.com.br',

  widgetColor: '#374b89',
  welcomeTitle: 'Fale com nosso Atendimento',
  welcomeTagline:
    'Tire dúvidas, peça suporte ou inicie seu atendimento pelo widget oficial.',

  position: 'right',
  locale: 'pt_BR',
  useBrowserLanguage: true,
  darkMode: 'auto',
  launcherType: 'expanded',
  launcherTitle: 'Atendimento',

  greetingEnabled: false,
  greetingMessage: 'Olá. Como podemos ajudar você hoje?',

  publishMode: 'all',
  allowedDomains: [],

  notes: '',
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
  return typeof value === 'string' ? value : fallback
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

function readStringArray(raw: Record<string, unknown> | null, key: string): string[] {
  const value = raw?.[key]
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function resolveWidgetConfigFromSettings(
  rawSettings: Record<string, unknown> | null,
  fallbackOrganizationName?: string
): WidgetConfig {
  const widgetRaw =
    rawSettings && typeof rawSettings.atendimentoWidget === 'object'
      ? (rawSettings.atendimentoWidget as Record<string, unknown>)
      : null

  const organizationName =
    readString(
      widgetRaw,
      'organizationName',
      fallbackOrganizationName?.trim() || DEFAULT_WIDGET_CONFIG.organizationName
    ) || fallbackOrganizationName?.trim() || DEFAULT_WIDGET_CONFIG.organizationName

  const merged: WidgetConfig = {
    organizationName,

    enabled: readBoolean(widgetRaw, 'enabled', DEFAULT_WIDGET_CONFIG.enabled),

    chatwootBaseUrl: readString(
      widgetRaw,
      'chatwootBaseUrl',
      DEFAULT_WIDGET_CONFIG.chatwootBaseUrl
    ),
    websiteToken: readString(widgetRaw, 'websiteToken', DEFAULT_WIDGET_CONFIG.websiteToken),
    websiteInboxName:
      readString(widgetRaw, 'websiteInboxName', '') ||
      readString(widgetRaw, 'organizationName', '') ||
      DEFAULT_WIDGET_CONFIG.websiteInboxName,
    websiteDomain:
      readString(widgetRaw, 'websiteDomain', '') || DEFAULT_WIDGET_CONFIG.websiteDomain,

    widgetColor:
      readString(widgetRaw, 'widgetColor', '') ||
      readString(widgetRaw, 'primaryColor', '') ||
      DEFAULT_WIDGET_CONFIG.widgetColor,

    welcomeTitle:
      readString(widgetRaw, 'welcomeTitle', '') ||
      readString(widgetRaw, 'title', '') ||
      DEFAULT_WIDGET_CONFIG.welcomeTitle,

    welcomeTagline:
      readString(widgetRaw, 'welcomeTagline', '') ||
      readString(widgetRaw, 'subtitle', '') ||
      DEFAULT_WIDGET_CONFIG.welcomeTagline,

    position: readEnum(
      widgetRaw,
      'position',
      ['left', 'right'] as const,
      DEFAULT_WIDGET_CONFIG.position
    ),

    locale: readString(widgetRaw, 'locale', DEFAULT_WIDGET_CONFIG.locale),
    useBrowserLanguage: readBoolean(
      widgetRaw,
      'useBrowserLanguage',
      DEFAULT_WIDGET_CONFIG.useBrowserLanguage
    ),
    darkMode: readEnum(
      widgetRaw,
      'darkMode',
      ['light', 'auto'] as const,
      DEFAULT_WIDGET_CONFIG.darkMode
    ),
    launcherType: readEnum(
      widgetRaw,
      'launcherType',
      ['standard', 'expanded'] as const,
      DEFAULT_WIDGET_CONFIG.launcherType
    ),
    launcherTitle:
      readString(widgetRaw, 'launcherTitle', '') ||
      readString(widgetRaw, 'buttonLabel', '') ||
      DEFAULT_WIDGET_CONFIG.launcherTitle,

    greetingEnabled: readBoolean(
      widgetRaw,
      'greetingEnabled',
      DEFAULT_WIDGET_CONFIG.greetingEnabled
    ),
    greetingMessage: readString(
      widgetRaw,
      'greetingMessage',
      DEFAULT_WIDGET_CONFIG.greetingMessage
    ),

    publishMode: readEnum(
      widgetRaw,
      'publishMode',
      ['all', 'allowlist'] as const,
      DEFAULT_WIDGET_CONFIG.publishMode
    ),
    allowedDomains: readStringArray(widgetRaw, 'allowedDomains'),

    notes: readString(widgetRaw, 'notes', DEFAULT_WIDGET_CONFIG.notes),
  }

  const parsed = widgetConfigSchema.safeParse(merged)

  if (parsed.success) {
    return parsed.data
  }

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
      websiteInboxName: organization.name || DEFAULT_WIDGET_CONFIG.websiteInboxName,
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