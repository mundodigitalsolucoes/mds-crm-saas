import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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
})

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
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

  const widgetRaw =
    parsedSettings && typeof parsedSettings.atendimentoWidget === 'object'
      ? parsedSettings.atendimentoWidget
      : null

  const parsedWidget = publicWidgetConfigSchema.safeParse(widgetRaw)

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