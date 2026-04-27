import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

const META_GRAPH_VERSION = 'v20.0'

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function readInstagramSettings(rawSettings: Record<string, unknown>) {
  return rawSettings.atendimentoInstagram &&
    typeof rawSettings.atendimentoInstagram === 'object'
    ? (rawSettings.atendimentoInstagram as Record<string, unknown>)
    : {}
}

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'edit'
  )

  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
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

  const currentInstagram = readInstagramSettings(parsedSettings)

  const facebookPageId =
    typeof currentInstagram.facebookPageId === 'string'
      ? currentInstagram.facebookPageId.trim()
      : ''

  const instagramBusinessId =
    typeof currentInstagram.instagramBusinessId === 'string'
      ? currentInstagram.instagramBusinessId.trim()
      : ''

  const encryptedPageToken =
    typeof currentInstagram.facebookPageAccessTokenEncrypted === 'string'
      ? currentInstagram.facebookPageAccessTokenEncrypted
      : ''

  if (!facebookPageId) {
    return NextResponse.json(
      {
        error:
          'Página Facebook não encontrada. Selecione a conta Instagram novamente.',
      },
      { status: 400 }
    )
  }

  if (!instagramBusinessId) {
    return NextResponse.json(
      {
        error:
          'Instagram Business ID não encontrado. Selecione a conta Instagram novamente.',
      },
      { status: 400 }
    )
  }

  if (!encryptedPageToken) {
    return NextResponse.json(
      {
        error:
          'Page access token não encontrado. Selecione a conta Instagram novamente.',
      },
      { status: 400 }
    )
  }

  const pageAccessToken = decryptToken(encryptedPageToken)

  const params = new URLSearchParams({
    subscribed_fields: [
      'messages',
      'messaging_postbacks',
      'message_reads',
      'message_reactions',
    ].join(','),
    access_token: pageAccessToken,
  })

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${facebookPageId}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
    }
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return NextResponse.json(
      {
        error: 'Erro ao assinar a Página Facebook no app da Meta.',
        details: data,
      },
      { status: response.status }
    )
  }

  const now = new Date().toISOString()

  const nextSettings = {
    ...parsedSettings,
    atendimentoInstagram: {
      ...currentInstagram,
      facebookPageId,
      instagramBusinessId,
      subscribedAppsStatus: 'subscribed',
      subscribedAppsFields: [
        'messages',
        'messaging_postbacks',
        'message_reads',
        'message_reactions',
      ],
      subscribedAppsAt: now,
      lastSubscribedAppsSyncAt: now,
      lastSubscribedAppsError: null,
      updatedAt: now,
    },
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: JSON.stringify(nextSettings),
    },
  })

  return NextResponse.json({
    success: true,
    status: 'subscribed',
    facebookPageId,
    instagramBusinessId,
    fields: [
      'messages',
      'messaging_postbacks',
      'message_reads',
      'message_reactions',
    ],
    meta: data,
  })
}