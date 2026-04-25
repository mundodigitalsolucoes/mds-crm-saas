import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

const META_GRAPH_VERSION = 'v20.0'

type MetaPage = {
  id: string
  name?: string
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
    fields: 'id,name,instagram_business_account{id,name,username}',
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
        success: false,
        error: 'Erro ao buscar páginas na Meta.',
        details: data.error?.message || data,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    totalPages: data.data?.length ?? 0,
    pages:
      data.data?.map((page) => ({
        pageId: page.id,
        pageName: page.name || '',
        hasInstagramBusinessAccount: Boolean(
          page.instagram_business_account?.id
        ),
        instagramBusinessAccount: page.instagram_business_account
          ? {
              id: page.instagram_business_account.id,
              name: page.instagram_business_account.name || '',
              username: page.instagram_business_account.username || '',
            }
          : null,
      })) ?? [],
  })
}