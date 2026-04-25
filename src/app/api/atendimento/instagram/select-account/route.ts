import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/integrations/crypto'

const META_GRAPH_VERSION = 'v20.0'

const selectAccountSchema = z.object({
  facebookPageId: z.string().min(1),
  instagramBusinessId: z.string().min(1),
})

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

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'edit'
  )

  if (!allowed) return errorResponse!

  const body = await req.json().catch(() => ({}))
  const parsed = selectAccountSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Conta Instagram inválida para seleção.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

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
        error: 'Erro ao validar conta selecionada na Meta.',
        details: data.error?.message || data,
      },
      { status: 500 }
    )
  }

  const selectedPage = data.data?.find(
    (page) =>
      page.id === parsed.data.facebookPageId &&
      page.instagram_business_account?.id === parsed.data.instagramBusinessId
  )

  if (!selectedPage?.instagram_business_account?.id) {
    return NextResponse.json(
      {
        error:
          'Conta selecionada não foi encontrada entre as contas autorizadas pela Meta.',
        selected: parsed.data,
        available:
          data.data?.map((page) => ({
            facebookPageId: page.id,
            facebookPageName: page.name || '',
            instagramBusinessId: page.instagram_business_account?.id || '',
            instagramUsername: page.instagram_business_account?.username || '',
          })) ?? [],
      },
      { status: 404 }
    )
  }

  const instagram = selectedPage.instagram_business_account
  const now = new Date().toISOString()

  const nextSettings = {
    ...parsedSettings,
    atendimentoInstagram: {
      ...currentInstagram,
      enabled: true,
      connectionMode: 'meta_api',
      status: 'connected',
      facebookPageId: selectedPage.id,
      facebookPageName: selectedPage.name || '',
      facebookPageAccessTokenEncrypted: selectedPage.access_token
        ? encryptToken(selectedPage.access_token)
        : '',
      instagramBusinessId: instagram.id,
      instagramAccountName: instagram.name || selectedPage.name || '',
      instagramHandle: instagram.username ? `@${instagram.username}` : '',
      selectedAt: now,
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
      id: selectedPage.id,
      name: selectedPage.name || '',
    },
    instagram: {
      id: instagram.id,
      name: instagram.name || '',
      username: instagram.username || '',
      handle: instagram.username ? `@${instagram.username}` : '',
    },
  })
}