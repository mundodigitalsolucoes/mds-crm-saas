import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { observeChannelEntitlement } from '@/lib/authorization/channel-observation'
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
  await observeChannelEntitlement(organizationId, 'instagram_channel')

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
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

  // Do not mutate the snapshot reserved for an unresolved Chatwoot inbox POST.
  if (['pending', 'reconciliation_required'].includes(String(currentInstagram.inboxProvisionStatus))) {
    return NextResponse.json(
      { error: 'Provisionamento da inbox pendente de reconciliação.' },
      { status: 409 }
    )
  }

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

  if (!response.ok) {
    return NextResponse.json(
      {
        error: 'Erro ao assinar a Página Facebook no app da Meta.',

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

  const saved = await prisma.organization.updateMany({
    where: { id: organizationId, deletedAt: null, settings: organization.settings },
    data: { settings: JSON.stringify(nextSettings) },
  })
  if (saved.count !== 1) {
    return NextResponse.json(
      { error: 'Configuração alterada durante a assinatura. Verifique o estado na Meta antes de tentar novamente.' },
      { status: 409 }
    )
  }

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
  })
}