import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const hexColorSchema = z.string().trim().regex(/^#([0-9A-Fa-f]{6})$/, 'Cor inválida.')
const domainSchema = z.string().trim().min(1).max(200)
const localeSchema = z.string().trim().min(2).max(20)

const publicWidgetConfigSchema = z.object({
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
})

type PublicWidgetConfig = z.infer<typeof publicWidgetConfigSchema>

const DEFAULT_PUBLIC_WIDGET_CONFIG: PublicWidgetConfig = {
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

function resolvePublicWidgetConfig(
  rawSettings: Record<string, unknown> | null,
  fallbackOrganizationName?: string
): PublicWidgetConfig {
  const widgetRaw =
    rawSettings && typeof rawSettings.atendimentoWidget === 'object'
      ? (rawSettings.atendimentoWidget as Record<string, unknown>)
      : null

  const organizationName =
    readString(
      widgetRaw,
      'organizationName',
      fallbackOrganizationName?.trim() || DEFAULT_PUBLIC_WIDGET_CONFIG.organizationName
    ) ||
    fallbackOrganizationName?.trim() ||
    DEFAULT_PUBLIC_WIDGET_CONFIG.organizationName

  const merged: PublicWidgetConfig = {
    organizationName,

    enabled: readBoolean(widgetRaw, 'enabled', DEFAULT_PUBLIC_WIDGET_CONFIG.enabled),

    chatwootBaseUrl: readString(
      widgetRaw,
      'chatwootBaseUrl',
      DEFAULT_PUBLIC_WIDGET_CONFIG.chatwootBaseUrl
    ),
    websiteToken: readString(
      widgetRaw,
      'websiteToken',
      DEFAULT_PUBLIC_WIDGET_CONFIG.websiteToken
    ),
    websiteInboxName:
      readString(widgetRaw, 'websiteInboxName', '') ||
      readString(widgetRaw, 'organizationName', '') ||
      DEFAULT_PUBLIC_WIDGET_CONFIG.websiteInboxName,
    websiteDomain:
      readString(widgetRaw, 'websiteDomain', '') ||
      DEFAULT_PUBLIC_WIDGET_CONFIG.websiteDomain,

    widgetColor:
      readString(widgetRaw, 'widgetColor', '') ||
      readString(widgetRaw, 'primaryColor', '') ||
      DEFAULT_PUBLIC_WIDGET_CONFIG.widgetColor,

    welcomeTitle:
      readString(widgetRaw, 'welcomeTitle', '') ||
      readString(widgetRaw, 'title', '') ||
      DEFAULT_PUBLIC_WIDGET_CONFIG.welcomeTitle,

    welcomeTagline:
      readString(widgetRaw, 'welcomeTagline', '') ||
      readString(widgetRaw, 'subtitle', '') ||
      DEFAULT_PUBLIC_WIDGET_CONFIG.welcomeTagline,

    position: readEnum(
      widgetRaw,
      'position',
      ['left', 'right'] as const,
      DEFAULT_PUBLIC_WIDGET_CONFIG.position
    ),
    locale: readString(widgetRaw, 'locale', DEFAULT_PUBLIC_WIDGET_CONFIG.locale),
    useBrowserLanguage: readBoolean(
      widgetRaw,
      'useBrowserLanguage',
      DEFAULT_PUBLIC_WIDGET_CONFIG.useBrowserLanguage
    ),
    darkMode: readEnum(
      widgetRaw,
      'darkMode',
      ['light', 'auto'] as const,
      DEFAULT_PUBLIC_WIDGET_CONFIG.darkMode
    ),
    launcherType: readEnum(
      widgetRaw,
      'launcherType',
      ['standard', 'expanded'] as const,
      DEFAULT_PUBLIC_WIDGET_CONFIG.launcherType
    ),
    launcherTitle:
      readString(widgetRaw, 'launcherTitle', '') ||
      readString(widgetRaw, 'buttonLabel', '') ||
      DEFAULT_PUBLIC_WIDGET_CONFIG.launcherTitle,

    greetingEnabled: readBoolean(
      widgetRaw,
      'greetingEnabled',
      DEFAULT_PUBLIC_WIDGET_CONFIG.greetingEnabled
    ),
    greetingMessage: readString(
      widgetRaw,
      'greetingMessage',
      DEFAULT_PUBLIC_WIDGET_CONFIG.greetingMessage
    ),

    publishMode: readEnum(
      widgetRaw,
      'publishMode',
      ['all', 'allowlist'] as const,
      DEFAULT_PUBLIC_WIDGET_CONFIG.publishMode
    ),
    allowedDomains: readStringArray(widgetRaw, 'allowedDomains'),
  }

  const parsed = publicWidgetConfigSchema.safeParse(merged)

  if (parsed.success) {
    return parsed.data
  }

  return {
    ...DEFAULT_PUBLIC_WIDGET_CONFIG,
    organizationName,
  }
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

  const config = resolvePublicWidgetConfig(parsedSettings, organization.name)

  return NextResponse.json(
    {
      orgScope: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      config,
      savedAt: organization.updatedAt.toISOString(),
    },
    {
      headers: corsHeaders(),
    }
  )
}