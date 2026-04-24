import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

type ChatwootAccountData = {
  chatwootAccountId?: number | string
  chatwootUrl?: string
}

type BusinessHourDayConfig = {
  enabled: boolean
  openTime: string
  closeTime: string
}

type BusinessHoursConfig = {
  monday: BusinessHourDayConfig
  tuesday: BusinessHourDayConfig
  wednesday: BusinessHourDayConfig
  thursday: BusinessHourDayConfig
  friday: BusinessHourDayConfig
  saturday: BusinessHourDayConfig
  sunday: BusinessHourDayConfig
}

type WidgetProvisionConfig = {
  organizationName: string
  enabled: boolean
  chatwootBaseUrl: string
  websiteToken: string
  websiteInboxName: string
  websiteDomain: string
  widgetColor: string
  welcomeTitle: string
  welcomeTagline: string
  greetingEnabled: boolean
  greetingMessage: string
  availabilityMode: 'always' | 'business_hours'
  businessHoursTimezone: string
  outOfOfficeMessage: string
  businessHours: BusinessHoursConfig
}

type WidgetRuntimeData = {
  chatwootInboxId?: number | string | null
  chatwootChannelId?: number | string | null
  websiteToken?: string
  webWidgetScript?: string
  provisionStatus?: string
  provisionedAt?: string
  lastSyncAt?: string
  lastError?: string | null
}

type ChatwootWorkingHour = {
  day_of_week: number
  closed_all_day: boolean
  open_all_day: boolean
  open_hour: number | null
  open_minutes: number | null
  close_hour: number | null
  close_minutes: number | null
}

type ChatwootInboxResponse = {
  id?: number
  channel_id?: number
  website_token?: string
  web_widget_script?: string
  website_url?: string
  name?: string
  widget_color?: string
  welcome_title?: string
  welcome_tagline?: string
  greeting_enabled?: boolean
  greeting_message?: string
  working_hours_enabled?: boolean
  out_of_office_message?: string
  timezone?: string
  working_hours?: ChatwootWorkingHour[]
}

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{6})$/, 'Cor inválida.')

class WidgetProvisionError extends Error {
  status: number
  code?: string
  detail?: string

  constructor(message: string, status = 500, code?: string, detail?: string) {
    super(message)
    this.name = 'WidgetProvisionError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeBaseUrl(url?: string | null) {
  return url?.trim().replace(/\/$/, '') || null
}

function normalizeWebsiteUrl(input: string) {
  const raw = input.trim()
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const normalized = withProtocol.replace(/\/$/, '')

  try {
    return new URL(normalized).toString().replace(/\/$/, '')
  } catch {
    throw new WidgetProvisionError(
      'Domínio principal do site inválido.',
      400,
      'INVALID_WEBSITE_DOMAIN'
    )
  }
}

function toPositiveInt(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
  return num
}

function parseChatwootAccountData(raw: string): ChatwootAccountData | null {
  try {
    const parsed = JSON.parse(raw) as ChatwootAccountData
    return parsed && typeof parsed === 'object' ? parsed : null
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

function readRuntimeScalar(
  raw: Record<string, unknown> | null,
  key: string
): string | number | null {
  const value = raw?.[key]

  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return null
}

function normalizeBusinessHourDay(
  value: unknown,
  fallback: BusinessHourDayConfig
): BusinessHourDayConfig {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : null

  return {
    enabled: readBoolean(raw, 'enabled', fallback.enabled),
    openTime: readString(raw, 'openTime', fallback.openTime),
    closeTime: readString(raw, 'closeTime', fallback.closeTime),
  }
}

function readBusinessHours(
  raw: Record<string, unknown> | null,
  key: string,
  fallback: BusinessHoursConfig
): BusinessHoursConfig {
  const value = raw?.[key]
  const businessRaw = value && typeof value === 'object' ? (value as Record<string, unknown>) : null

  return {
    monday: normalizeBusinessHourDay(businessRaw?.monday, fallback.monday),
    tuesday: normalizeBusinessHourDay(businessRaw?.tuesday, fallback.tuesday),
    wednesday: normalizeBusinessHourDay(businessRaw?.wednesday, fallback.wednesday),
    thursday: normalizeBusinessHourDay(businessRaw?.thursday, fallback.thursday),
    friday: normalizeBusinessHourDay(businessRaw?.friday, fallback.friday),
    saturday: normalizeBusinessHourDay(businessRaw?.saturday, fallback.saturday),
    sunday: normalizeBusinessHourDay(businessRaw?.sunday, fallback.sunday),
  }
}

function resolveWidgetConfig(
  rawSettings: Record<string, unknown> | null,
  fallbackOrganizationName?: string
): WidgetProvisionConfig {
  const widgetRaw =
    rawSettings && typeof rawSettings.atendimentoWidget === 'object'
      ? (rawSettings.atendimentoWidget as Record<string, unknown>)
      : null

  return {
    organizationName:
      readString(widgetRaw, 'organizationName', '').trim() ||
      fallbackOrganizationName?.trim() ||
      'Organização',
    enabled: readBoolean(widgetRaw, 'enabled', false),
    chatwootBaseUrl:
      normalizeBaseUrl(readString(widgetRaw, 'chatwootBaseUrl', '')) || '',
    websiteToken: readString(widgetRaw, 'websiteToken', '').trim(),
    websiteInboxName: readString(widgetRaw, 'websiteInboxName', '').trim(),
    websiteDomain: readString(widgetRaw, 'websiteDomain', '').trim(),
    widgetColor: readString(widgetRaw, 'widgetColor', '#374b89').trim(),
    welcomeTitle: readString(widgetRaw, 'welcomeTitle', '').trim(),
    welcomeTagline: readString(widgetRaw, 'welcomeTagline', '').trim(),
    greetingEnabled: readBoolean(widgetRaw, 'greetingEnabled', false),
    greetingMessage: readString(widgetRaw, 'greetingMessage', '').trim(),
    availabilityMode:
      readString(widgetRaw, 'availabilityMode', 'always') === 'business_hours'
        ? 'business_hours'
        : 'always',
    businessHoursTimezone:
      readString(widgetRaw, 'businessHoursTimezone', 'America/Sao_Paulo').trim() ||
      'America/Sao_Paulo',
    outOfOfficeMessage: readString(widgetRaw, 'outOfOfficeMessage', '').trim(),
    businessHours: readBusinessHours(widgetRaw, 'businessHours', {
      monday: { enabled: true, openTime: '08:00', closeTime: '18:00' },
      tuesday: { enabled: true, openTime: '08:00', closeTime: '18:00' },
      wednesday: { enabled: true, openTime: '08:00', closeTime: '18:00' },
      thursday: { enabled: true, openTime: '08:00', closeTime: '18:00' },
      friday: { enabled: true, openTime: '08:00', closeTime: '18:00' },
      saturday: { enabled: true, openTime: '08:00', closeTime: '12:00' },
      sunday: { enabled: false, openTime: '08:00', closeTime: '12:00' },
    }),
  }
}

function resolveWidgetRuntime(
  rawSettings: Record<string, unknown> | null
): WidgetRuntimeData {
  const runtimeRaw =
    rawSettings && typeof rawSettings.atendimentoWidgetRuntime === 'object'
      ? (rawSettings.atendimentoWidgetRuntime as Record<string, unknown>)
      : null

  return {
    chatwootInboxId: readRuntimeScalar(runtimeRaw, 'chatwootInboxId'),
    chatwootChannelId: readRuntimeScalar(runtimeRaw, 'chatwootChannelId'),
    websiteToken:
      typeof runtimeRaw?.websiteToken === 'string' ? runtimeRaw.websiteToken : '',
    webWidgetScript:
      typeof runtimeRaw?.webWidgetScript === 'string'
        ? runtimeRaw.webWidgetScript
        : '',
    provisionStatus:
      typeof runtimeRaw?.provisionStatus === 'string'
        ? runtimeRaw.provisionStatus
        : 'draft',
    provisionedAt:
      typeof runtimeRaw?.provisionedAt === 'string'
        ? runtimeRaw.provisionedAt
        : '',
    lastSyncAt:
      typeof runtimeRaw?.lastSyncAt === 'string' ? runtimeRaw.lastSyncAt : '',
    lastError:
      typeof runtimeRaw?.lastError === 'string' ? runtimeRaw.lastError : null,
  }
}

function validateProvisionConfig(config: WidgetProvisionConfig) {
  if (!config.websiteInboxName) {
    throw new WidgetProvisionError(
      'Nome da caixa de entrada do site é obrigatório.',
      400,
      'MISSING_WEBSITE_INBOX_NAME'
    )
  }

  if (!config.websiteDomain) {
    throw new WidgetProvisionError(
      'Domínio principal do site é obrigatório.',
      400,
      'MISSING_WEBSITE_DOMAIN'
    )
  }

  if (!config.welcomeTitle) {
    throw new WidgetProvisionError(
      'Texto de boas-vindas é obrigatório.',
      400,
      'MISSING_WELCOME_TITLE'
    )
  }

  if (!config.welcomeTagline) {
    throw new WidgetProvisionError(
      'Mensagem de boas-vindas é obrigatória.',
      400,
      'MISSING_WELCOME_TAGLINE'
    )
  }

  if (!hexColorSchema.safeParse(config.widgetColor).success) {
    throw new WidgetProvisionError(
      'Cor do widget inválida.',
      400,
      'INVALID_WIDGET_COLOR'
    )
  }
}

function parseTimeParts(value: string) {
  const [hourRaw, minuteRaw] = value.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new WidgetProvisionError(
      'Horário de atendimento inválido.',
      400,
      'INVALID_BUSINESS_HOURS_TIME'
    )
  }

  return { hour, minute }
}

function buildWorkingHours(config: WidgetProvisionConfig): ChatwootWorkingHour[] {
  const dayMap: Array<[number, keyof BusinessHoursConfig]> = [
    [0, 'sunday'],
    [1, 'monday'],
    [2, 'tuesday'],
    [3, 'wednesday'],
    [4, 'thursday'],
    [5, 'friday'],
    [6, 'saturday'],
  ]

  return dayMap.map(([dayOfWeek, key]) => {
    const day = config.businessHours[key]

    if (!day.enabled) {
      return {
        day_of_week: dayOfWeek,
        closed_all_day: true,
        open_all_day: false,
        open_hour: null,
        open_minutes: null,
        close_hour: null,
        close_minutes: null,
      }
    }

    const open = parseTimeParts(day.openTime)
    const close = parseTimeParts(day.closeTime)

    return {
      day_of_week: dayOfWeek,
      closed_all_day: false,
      open_all_day: false,
      open_hour: open.hour,
      open_minutes: open.minute,
      close_hour: close.hour,
      close_minutes: close.minute,
    }
  })
}

function buildCreatePayload(config: WidgetProvisionConfig) {
  return {
    name: config.websiteInboxName,
    greeting_enabled: config.greetingEnabled,
    greeting_message: config.greetingEnabled ? config.greetingMessage : '',
    working_hours_enabled: config.availabilityMode === 'business_hours',
    out_of_office_message:
      config.availabilityMode === 'business_hours' ? config.outOfOfficeMessage : '',
    timezone: config.businessHoursTimezone,
    working_hours: buildWorkingHours(config),
    channel: {
      type: 'web_widget',
      website_url: normalizeWebsiteUrl(config.websiteDomain),
      welcome_title: config.welcomeTitle,
      welcome_tagline: config.welcomeTagline,
      widget_color: config.widgetColor,
    },
  }
}

function buildUpdatePayload(config: WidgetProvisionConfig) {
  return {
    name: config.websiteInboxName,
    greeting_enabled: config.greetingEnabled,
    greeting_message: config.greetingEnabled ? config.greetingMessage : '',
    working_hours_enabled: config.availabilityMode === 'business_hours',
    out_of_office_message:
      config.availabilityMode === 'business_hours' ? config.outOfOfficeMessage : '',
    timezone: config.businessHoursTimezone,
    working_hours: buildWorkingHours(config),
    channel: {
      website_url: normalizeWebsiteUrl(config.websiteDomain),
      welcome_title: config.welcomeTitle,
      welcome_tagline: config.welcomeTagline,
      widget_color: config.widgetColor,
    },
  }
}

async function chatwootRequest<T>(params: {
  url: string
  apiToken: string
  method: 'POST' | 'PATCH'
  body: Record<string, unknown>
}): Promise<T> {
  const response = await fetch(params.url, {
    method: params.method,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: params.apiToken,
    },
    body: JSON.stringify(params.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })

  const text = await response.text().catch(() => '')
  const json = text
    ? safeJsonParse<T & { error?: string; message?: string }>(text)
    : null

  if (!response.ok) {
    const detail =
      (json &&
      typeof json === 'object' &&
      ('error' in json || 'message' in json)
        ? String(
            (json as { error?: string; message?: string }).error ||
              (json as { error?: string; message?: string }).message ||
              ''
          )
        : '') ||
      text ||
      `chatwoot_http_${response.status}`

    throw new WidgetProvisionError(
      'Falha ao ativar o canal do site no Atendimento.',
      response.status,
      'CHATWOOT_INBOX_REQUEST_FAILED',
      detail
    )
  }

  if (json) return json as T

  throw new WidgetProvisionError(
    'Resposta inválida do Atendimento ao ativar o canal do site.',
    502,
    'INVALID_CHATWOOT_RESPONSE'
  )
}

async function persistRuntimeError(params: {
  organizationId: string
  parsedSettings: Record<string, unknown>
  runtime: WidgetRuntimeData
  message: string
}) {
  try {
    const nextSettings = {
      ...params.parsedSettings,
      atendimentoWidgetRuntime: {
        ...params.runtime,
        provisionStatus: 'error',
        lastError: params.message,
        lastSyncAt: new Date().toISOString(),
      },
    }

    await prisma.organization.update({
      where: { id: params.organizationId },
      data: {
        settings: JSON.stringify(nextSettings),
      },
    })
  } catch {
    // noop
  }
}

export async function POST() {
  const perm = await checkPermission('integrations', 'edit')

  if (!perm.allowed || !perm.session) {
    return (
      perm.errorResponse ??
      NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    )
  }

  const organizationId = perm.session.user.organizationId

  const [organization, chatwootAccount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        settings: true,
        chatwootAccountId: true,
        chatwootUrl: true,
        updatedAt: true,
      },
    }),
    prisma.connectedAccount.findUnique({
      where: {
        provider_organizationId: {
          provider: 'chatwoot',
          organizationId,
        },
      },
      select: {
        id: true,
        isActive: true,
        accessTokenEnc: true,
        data: true,
      },
    }),
  ])

  if (!organization) {
    return NextResponse.json({ error: 'organization_not_found' }, { status: 404 })
  }

  const parsedSettings =
    safeJsonParse<Record<string, unknown>>(organization.settings) ?? {}

  const config = resolveWidgetConfig(parsedSettings, organization.name)
  const runtime = resolveWidgetRuntime(parsedSettings)

  try {
    validateProvisionConfig(config)

    if (!chatwootAccount?.isActive) {
      throw new WidgetProvisionError(
        'Integração do Atendimento não está ativa para esta organização.',
        409,
        'CHATWOOT_NOT_CONNECTED'
      )
    }

    if (!chatwootAccount.accessTokenEnc?.trim()) {
      throw new WidgetProvisionError(
        'Token da integração do Atendimento não encontrado.',
        409,
        'CHATWOOT_API_TOKEN_MISSING'
      )
    }

    const chatwootData = parseChatwootAccountData(chatwootAccount.data)
    if (!chatwootData) {
      throw new WidgetProvisionError(
        'Payload da integração do Atendimento está inválido.',
        409,
        'INVALID_CHATWOOT_CONNECTED_ACCOUNT'
      )
    }

    const connectedAccountId = toPositiveInt(chatwootData.chatwootAccountId)
    if (!connectedAccountId) {
      throw new WidgetProvisionError(
        'chatwootAccountId não encontrado na integração do Atendimento.',
        409,
        'CHATWOOT_ACCOUNT_ID_MISSING'
      )
    }

    const organizationAccountId = toPositiveInt(organization.chatwootAccountId)
    if (organizationAccountId && organizationAccountId !== connectedAccountId) {
      throw new WidgetProvisionError(
        'Conta do Atendimento inconsistente entre organização e integração.',
        409,
        'CHATWOOT_ACCOUNT_MISMATCH'
      )
    }

    const apiToken = decryptToken(chatwootAccount.accessTokenEnc)
    const apiBaseUrl =
      normalizeBaseUrl(process.env.CHATWOOT_INTERNAL_URL) ||
      config.chatwootBaseUrl ||
      normalizeBaseUrl(organization.chatwootUrl) ||
      normalizeBaseUrl(chatwootData.chatwootUrl)

    if (!apiBaseUrl) {
      throw new WidgetProvisionError(
        'Base URL do Atendimento não configurada.',
        409,
        'CHATWOOT_BASE_URL_MISSING'
      )
    }

    const existingInboxId = toPositiveInt(runtime.chatwootInboxId)

    let inboxResponse: ChatwootInboxResponse
    let action: 'created' | 'updated'

    if (existingInboxId) {
      try {
        inboxResponse = await chatwootRequest<ChatwootInboxResponse>({
          url: `${apiBaseUrl}/api/v1/accounts/${connectedAccountId}/inboxes/${existingInboxId}`,
          apiToken,
          method: 'PATCH',
          body: buildUpdatePayload(config),
        })
        action = 'updated'
      } catch (error) {
        if (error instanceof WidgetProvisionError && error.status === 404) {
          inboxResponse = await chatwootRequest<ChatwootInboxResponse>({
            url: `${apiBaseUrl}/api/v1/accounts/${connectedAccountId}/inboxes`,
            apiToken,
            method: 'POST',
            body: buildCreatePayload(config),
          })
          action = 'created'
        } else {
          throw error
        }
      }
    } else {
      inboxResponse = await chatwootRequest<ChatwootInboxResponse>({
        url: `${apiBaseUrl}/api/v1/accounts/${connectedAccountId}/inboxes`,
        apiToken,
        method: 'POST',
        body: buildCreatePayload(config),
      })
      action = 'created'
    }

    const inboxId = toPositiveInt(inboxResponse.id)
    if (!inboxId) {
      throw new WidgetProvisionError(
        'Resposta do Atendimento sem inbox id.',
        502,
        'CHATWOOT_INBOX_ID_MISSING'
      )
    }

    const channelId = toPositiveInt(inboxResponse.channel_id)
    const websiteToken =
      inboxResponse.website_token?.trim() ||
      runtime.websiteToken?.trim() ||
      config.websiteToken.trim()

    const webWidgetScript =
      inboxResponse.web_widget_script?.trim() ||
      runtime.webWidgetScript?.trim() ||
      ''

    const nowIso = new Date().toISOString()

    const existingWidgetSettings =
      parsedSettings.atendimentoWidget &&
      typeof parsedSettings.atendimentoWidget === 'object'
        ? (parsedSettings.atendimentoWidget as Record<string, unknown>)
        : {}

    const nextSettings = {
      ...parsedSettings,
      atendimentoWidget: {
        ...existingWidgetSettings,
        ...config,
        websiteToken,
        updatedAt: nowIso,
      },
      atendimentoWidgetRuntime: {
        ...runtime,
        chatwootInboxId: inboxId,
        chatwootChannelId: channelId,
        websiteToken,
        webWidgetScript,
        provisionStatus: 'agents_pending',
        provisionedAt:
          action === 'created' ? nowIso : runtime.provisionedAt || nowIso,
        lastSyncAt: nowIso,
        lastError: null,
      },
    }

    const updatedOrganization = await prisma.organization.update({
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
      action,
      orgScope: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        slug: updatedOrganization.slug,
        plan: updatedOrganization.plan,
      },
      inbox: {
        chatwootInboxId: inboxId,
        chatwootChannelId: channelId,
        websiteToken,
        websiteUrl:
          inboxResponse.website_url?.trim() ||
          normalizeWebsiteUrl(config.websiteDomain),
        webWidgetScript,
      },
      runtime: {
        provisionStatus: 'agents_pending',
        lastSyncAt: nowIso,
      },
      savedAt: updatedOrganization.updatedAt.toISOString(),
    })
  } catch (error) {
    const message =
      error instanceof WidgetProvisionError
        ? error.message
        : 'Erro inesperado ao ativar o widget do Atendimento.'

    await persistRuntimeError({
      organizationId,
      parsedSettings,
      runtime,
      message,
    })

    if (error instanceof WidgetProvisionError) {
      return NextResponse.json(
        {
          error: error.code || 'WIDGET_PROVISION_FAILED',
          message: error.message,
          detail: error.detail || null,
        },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        error: 'WIDGET_PROVISION_FAILED',
        message,
      },
      { status: 500 }
    )
  }
}
