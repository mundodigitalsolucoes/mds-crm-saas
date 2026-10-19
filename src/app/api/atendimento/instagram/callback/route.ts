import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/checkPermission'
import { verifyInstagramState } from '@/lib/atendimento/instagram-oauth-state'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

const META_GRAPH_VERSION = 'v20.0'

type MetaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: {
    message?: string
    type?: string
    code?: number
    fbtrace_id?: string
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

function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`)
  }

  return value
}

function redirectToInstagramSettings(
  status: 'success' | 'error',
  message: string
) {
  const url = new URL(
    '/settings/atendimento/instagram',
    process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br'
  )

  url.searchParams.set('instagramCallback', status)
  url.searchParams.set('message', message)

  const response = NextResponse.redirect(url)
  response.cookies.set('mds_instagram_oauth_nonce', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/atendimento/instagram/callback',
    maxAge: 0,
  })
  return response
}

async function exchangeCodeForToken(code: string) {
  const appId = getRequiredEnv('META_INSTAGRAM_APP_ID')
  const appSecret = getRequiredEnv('META_INSTAGRAM_APP_SECRET')
  const appUrl = getRequiredEnv('NEXTAUTH_URL')

  const redirectUri = `${appUrl}/api/atendimento/instagram/callback`

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  })

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
    {
      method: 'GET',
      cache: 'no-store',
    }
  )

  const data = (await response.json()) as MetaTokenResponse

  if (!response.ok || !data.access_token) {
    throw new Error('A Meta não retornou um token válido.')
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || '',
    expiresIn: data.expires_in || null,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const rawState = searchParams.get('state')

  if (error) {
    return redirectToInstagramSettings(
      'error',
      'Conexão com Instagram cancelada ou recusada.'
    )
  }

  if (!code) {
    return redirectToInstagramSettings(
      'error',
      'Código de autorização da Meta não recebido.'
    )
  }

  const state = verifyInstagramState(rawState)

  if (!state) {
    return redirectToInstagramSettings(
      'error',
      'State inválido na conexão com a Meta.'
    )
  }

  const nonceCookie = req.cookies.get('mds_instagram_oauth_nonce')?.value
  const expectedNonce = Buffer.from(state.nonce)
  const receivedNonce = Buffer.from(nonceCookie ?? '')
  if (receivedNonce.length !== expectedNonce.length || !timingSafeEqual(receivedNonce, expectedNonce)) {
    return redirectToInstagramSettings('error', 'Conexão expirada ou iniciada em outro navegador.')
  }

  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.id !== state.userId || session.user.organizationId !== state.organizationId) {
    return redirectToInstagramSettings('error', 'Sessão inválida ou diferente da que iniciou a conexão.')
  }

  // Revalidate current operational permission and tenant status before exchanging
  // the authorization code. A session may outlive a revoked integration grant.
  const permission = await checkPermission('integrations', 'edit')
  if (!permission.allowed ||
      permission.session?.user.id !== state.userId ||
      permission.session?.user.organizationId !== state.organizationId) {
    return redirectToInstagramSettings('error', 'Permissão de integração revogada ou sessão inválida.')
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

  try {
    const token = await exchangeCodeForToken(code)

    const parsedSettings =
      safeJsonParse<Record<string, unknown>>(organization.settings) ?? {}

    const currentInstagram =
      parsedSettings.atendimentoInstagram &&
      typeof parsedSettings.atendimentoInstagram === 'object'
        ? (parsedSettings.atendimentoInstagram as Record<string, unknown>)
        : {}

    const now = new Date().toISOString()

    const nextSettings = {
      ...parsedSettings,
      atendimentoInstagram: {
        ...currentInstagram,
        enabled: true,
        connectionMode: 'meta_api',
        status: 'token_received',
        metaAuthorizationCodeReceived: true,
        metaAuthorizationCodeReceivedAt: now,
        metaAuthorizationCodePreview: `${code.slice(0, 8)}...`,
        metaAccessTokenEncrypted: encryptToken(token.accessToken),
        metaAccessTokenPreview: `${token.accessToken.slice(0, 10)}...`,
        metaTokenType: token.tokenType,
        metaTokenExpiresIn: token.expiresIn,
        metaTokenReceivedAt: now,
        updatedAt: now,
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
      'Token da Meta recebido com sucesso. Próximo passo: buscar página e conta Instagram.'
    )
  } catch {
    return redirectToInstagramSettings(
      'error',
      'Não foi possível concluir a conexão com a Meta.'
    )
  }
}