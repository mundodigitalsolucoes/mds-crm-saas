import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { observeChannelEntitlement } from '@/lib/authorization/channel-observation'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

const META_GRAPH_VERSION = 'v20.0'
type GraphEntity = { id: string; name?: string; instagram_business_account?: { id?: string } }
type GraphPayload = { data?: GraphEntity[] }

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

async function graphGet(path: string, accessToken: string) {
  const separator = path.includes('?') ? '&' : '?'

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${path}${separator}access_token=${encodeURIComponent(
      accessToken
    )}`,
    { method: 'GET', cache: 'no-store' }
  )

  const data: GraphPayload = await response.json().catch(() => ({}))

  return {
    ok: response.ok,
    status: response.status,
    data,
  }
}

export async function GET(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'view'
  )

  if (!allowed) return errorResponse!
  await observeChannelEntitlement(session!.user.organizationId, 'instagram_channel')

  const organizationId = session!.user.organizationId

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { settings: true },
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
  const { searchParams } = new URL(req.url)

  const requestedBusinessId =
    searchParams.get('businessId') ||
    (typeof currentInstagram.metaBusinessId === 'string'
      ? currentInstagram.metaBusinessId
      : '')

  // Diagnostic paths must never contain untrusted Graph API path segments.
  if (requestedBusinessId && !/^\d{1,32}$/.test(requestedBusinessId)) {
    return NextResponse.json(
      { error: 'Business ID inválido.' },
      { status: 400 }
    )
  }

  const meAccounts = await graphGet(
    'me/accounts?fields=id,name,instagram_business_account{id,name,username}',
    accessToken
  )

  const businesses = requestedBusinessId
    ? {
        ok: true,
        status: 200,
        data: {
          data: [{ id: requestedBusinessId, name: 'Business informado' }],
        },
      }
    : await graphGet('me/businesses?fields=id,name', accessToken)

  const businessList = Array.isArray(businesses.data?.data)
    ? businesses.data.data
    : []

  const businessPages = await Promise.all(
    businessList.map(async (business: GraphEntity) => {
      const businessId = business.id

      const ownedPages = await graphGet(
        `${businessId}/owned_pages?fields=id,name,instagram_business_account{id,name,username}`,
        accessToken
      )

      const clientPages = await graphGet(
        `${businessId}/client_pages?fields=id,name,instagram_business_account{id,name,username}`,
        accessToken
      )

      return {
        business: {
          id: businessId,
          name: business.name || '',
        },
        ownedPages,
        clientPages,
      }
    })
  )

  const safeResult = (result: { ok: boolean; status: number; data: GraphPayload }) => ({
    ok: result.ok,
    status: result.status,
    pages: Array.isArray(result.data?.data)
      ? result.data.data.map((page: GraphEntity) => ({
          id: String(page.id || ''),
          name: String(page.name || ''),
          instagramBusinessId: String(page.instagram_business_account?.id || ''),
        }))
      : [],
  })

  return NextResponse.json({
    success: true,
    hint:
      'Compare meAccounts com ownedPages/clientPages. Se BM retornar mais páginas, o sync precisa usar Business Manager, não só /me/accounts.',
    meAccounts: safeResult(meAccounts),
    businesses: safeResult(businesses),
    businessPages: businessPages.map((entry) => ({
      business: entry.business,
      ownedPages: safeResult(entry.ownedPages),
      clientPages: safeResult(entry.clientPages),
    })),
  })
}
