import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const publicWidgetConfigSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(400),
  ctaLabel: z.string().trim().min(1).max(80),
  online: z.boolean(),
  position: z.enum(['right', 'left']),
  buttonLabel: z.string().trim().min(1).max(80),
  primaryActionUrl: z.string().trim().url().max(300),
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