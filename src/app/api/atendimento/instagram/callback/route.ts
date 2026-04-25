import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const callbackStateSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().min(1),
  source: z.literal('mds_crm_instagram'),
})

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function decodeState(rawState: string | null) {
  if (!rawState) return null

  try {
    const decoded = Buffer.from(rawState, 'base64url').toString('utf-8')
    const parsed = JSON.parse(decoded)
    const result = callbackStateSchema.safeParse(parsed)

    if (!result.success) return null

    return result.data
  } catch {
    return null
  }
}

function redirectToInstagramSettings(status: 'success' | 'error', message: string) {
  const url = new URL(
    '/settings/atendimento/instagram',
    process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br'
  )

  url.searchParams.set('instagramCallback', status)
  url.searchParams.set('message', message)

  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const rawState = searchParams.get('state')

  if (error) {
    return redirectToInstagramSettings(
      'error',
      errorDescription || 'Conexão com Instagram cancelada ou recusada.'
    )
  }

  if (!code) {
    return redirectToInstagramSettings(
      'error',
      'Código de autorização da Meta não recebido.'
    )
  }

  const state = decodeState(rawState)

  if (!state) {
    return redirectToInstagramSettings(
      'error',
      'State inválido na conexão com a Meta.'
    )
  }

  const organization = await prisma.organization.findUnique({
    where: { id: state.organizationId },
    select: {
      id: true,
      settings: true,
    },
  })

  if (!organization) {
    return redirectToInstagramSettings(
      'error',
      'Organização não encontrada.'
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
      enabled: true,
      connectionMode: 'meta_api',
      status: 'pending_connection',
      metaAuthorizationCodeReceived: true,
      metaAuthorizationCodeReceivedAt: new Date().toISOString(),
      metaAuthorizationCodePreview: `${code.slice(0, 8)}...`,
      updatedAt: new Date().toISOString(),
    },
  }

  await prisma.organization.update({
    where: { id: state.organizationId },
    data: {
      settings: JSON.stringify(nextSettings),
    },
  })

  return redirectToInstagramSettings(
    'success',
    'Autorização inicial da Meta recebida. Próximo passo: troca segura do token.'
  )
}