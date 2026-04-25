import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/integrations/crypto'

const META_GRAPH_VERSION = 'v20.0'
const TARGET_FACEBOOK_PAGE_ID = '109568358707186'

type MetaPage = {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: {
    id: string
    name?: string
    username?: string
  }
}

type MetaPagesResponse = {
  data?: MetaPage[]
  error?: {
    message?: string
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
      id: true,
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

  const encryptedToken = currentInstagram.metaAccessTokenEncrypted

  if (typeof encryptedToken !== 'string' || !encryptedToken) {
    return NextResponse.json(
      { error: 'Token Meta não encontrado. Refaça a conexão.' },
      { status: 400 }
    )
  }

  const accessToken = decryptToken(encryptedToken)

  const params = new URLSearchParams({
    fields:
      'id,name,access_token,instagram_business_account{id,name,username}',
    access_token: accessToken,
  })

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?${params.toString()}`,
    {
      method: 'GET',
      cache: 'no-store',
    }
  )

  const data = (await response.json()) as MetaPagesResponse

  if (!response.ok) {
    return NextResponse.json(
      {
        error: 'Erro ao buscar páginas na Meta.',
        details: data.error?.message || data,
      },
      { status: 500 }
    )
  }

  const pages = data.data ?? []

  const targetPage = pages.find((page) => page.id === TARGET_FACEBOOK_PAGE_ID)

  if (!targetPage) {
    return NextResponse.json(
      {
        error: 'Página Mundo Digital não encontrada no token Meta atual.',
        expectedFacebookPageId: TARGET_FACEBOOK_PAGE_ID,
        pages: pages.map((page) => ({
          id: page.id,
          name: page.name || '',
          hasInstagram: Boolean(page.instagram_business_account?.id),
          instagramBusinessId: page.instagram_business_account?.id || '',
          instagramUsername: page.instagram_business_account?.username || '',
        })),
      },
      { status: 404 }
    )
  }

  if (!targetPage.instagram_business_account?.id) {
    return NextResponse.json(
      {
        error:
          'Página Mundo Digital encontrada, mas sem Instagram Business vinculado.',
        facebookPage: {
          id: targetPage.id,
          name: targetPage.name || '',
        },
      },
      { status: 404 }
    )
  }

  const instagram = targetPage.instagram_business_account
  const now = new Date().toISOString()

  const nextSettings = {
    ...parsedSettings,
    atendimentoInstagram: {
      ...currentInstagram,
      enabled: true,
      connectionMode: 'meta_api',
      status: 'connected',
      facebookPageId: targetPage.id,
      facebookPageName: targetPage.name || '',
      facebookPageAccessTokenEncrypted: targetPage.access_token
        ? encryptToken(targetPage.access_token)
        : '',
      instagramBusinessId: instagram.id,
      instagramAccountName: instagram.name || targetPage.name || '',
      instagramHandle: instagram.username ? `@${instagram.username}` : '',
      syncedAt: now,
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
    status: 'connected',
    facebookPage: {
      id: targetPage.id,
      name: targetPage.name || '',
    },
    instagram: {
      id: instagram.id,
      name: instagram.name || '',
      username: instagram.username || '',
      handle: instagram.username ? `@${instagram.username}` : '',
    },
  })
}