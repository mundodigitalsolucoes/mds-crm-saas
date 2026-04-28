import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

const instagramStatusSchema = z.enum([
  'draft',
  'pending_connection',
  'token_received',
  'connected',
  'error',
])

const instagramConfigSchema = z.object({
  enabled: z.boolean(),
  facebookPageId: z.string().trim().max(120),
  facebookPageName: z.string().trim().max(120),
  instagramAccountName: z.string().trim().max(120),
  instagramHandle: z.string().trim().max(80),
  instagramBusinessId: z.string().trim().max(120),
  inboxName: z.string().trim().min(1).max(120),
  connectionMode: z.enum(['meta_api', 'manual_token']),
  status: instagramStatusSchema,
  notes: z.string().trim().max(500),
})

type InstagramConfig = z.infer<typeof instagramConfigSchema>

const DEFAULT_INSTAGRAM_CONFIG: InstagramConfig = {
  enabled: false,
  facebookPageId: '',
  facebookPageName: '',
  instagramAccountName: '',
  instagramHandle: '',
  instagramBusinessId: '',
  inboxName: 'Instagram Direct',
  connectionMode: 'meta_api',
  status: 'draft',
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

function resolveInstagramConfigFromSettings(
  rawSettings: Record<string, unknown> | null
): InstagramConfig {
  const instagramRaw =
    rawSettings && typeof rawSettings.atendimentoInstagram === 'object'
      ? (rawSettings.atendimentoInstagram as Record<string, unknown>)
      : null

  const merged: InstagramConfig = {
    enabled: readBoolean(
      instagramRaw,
      'enabled',
      DEFAULT_INSTAGRAM_CONFIG.enabled
    ),
    facebookPageId: readString(
      instagramRaw,
      'facebookPageId',
      DEFAULT_INSTAGRAM_CONFIG.facebookPageId
    ),
    facebookPageName: readString(
      instagramRaw,
      'facebookPageName',
      DEFAULT_INSTAGRAM_CONFIG.facebookPageName
    ),
    instagramAccountName: readString(
      instagramRaw,
      'instagramAccountName',
      DEFAULT_INSTAGRAM_CONFIG.instagramAccountName
    ),
    instagramHandle: readString(
      instagramRaw,
      'instagramHandle',
      DEFAULT_INSTAGRAM_CONFIG.instagramHandle
    ),
    instagramBusinessId: readString(
      instagramRaw,
      'instagramBusinessId',
      DEFAULT_INSTAGRAM_CONFIG.instagramBusinessId
    ),
    inboxName:
      readString(instagramRaw, 'inboxName', '') ||
      DEFAULT_INSTAGRAM_CONFIG.inboxName,
    connectionMode: readEnum(
      instagramRaw,
      'connectionMode',
      ['meta_api', 'manual_token'] as const,
      DEFAULT_INSTAGRAM_CONFIG.connectionMode
    ),
    status: readEnum(
      instagramRaw,
      'status',
      [
        'draft',
        'pending_connection',
        'token_received',
        'connected',
        'error',
      ] as const,
      DEFAULT_INSTAGRAM_CONFIG.status
    ),
    notes: readString(instagramRaw, 'notes', DEFAULT_INSTAGRAM_CONFIG.notes),
  }

  const parsed = instagramConfigSchema.safeParse(merged)

  if (parsed.success) {
    return parsed.data
  }

  return DEFAULT_INSTAGRAM_CONFIG
}

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'view'
  )

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

  const config = resolveInstagramConfigFromSettings(parsedSettings)

  return NextResponse.json({
    orgScope: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
    },
    config,
    defaults: DEFAULT_INSTAGRAM_CONFIG,
    savedAt: organization.updatedAt.toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'edit'
  )

  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const body = await req.json().catch(() => ({}))

  const parsed = instagramConfigSchema.safeParse({
    ...body,
    facebookPageId: body?.facebookPageId ?? '',
    facebookPageName: body?.facebookPageName ?? '',
    status: body?.status ?? DEFAULT_INSTAGRAM_CONFIG.status,
    connectionMode:
      body?.connectionMode === 'manual_token' ? 'manual_token' : 'meta_api',
  })

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Dados inválidos para salvar a configuração do Instagram.',
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

  const currentInstagram =
    parsedSettings.atendimentoInstagram &&
    typeof parsedSettings.atendimentoInstagram === 'object'
      ? (parsedSettings.atendimentoInstagram as Record<string, unknown>)
      : {}

  const nextSettings = {
    ...parsedSettings,
    atendimentoInstagram: {
      ...currentInstagram,
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