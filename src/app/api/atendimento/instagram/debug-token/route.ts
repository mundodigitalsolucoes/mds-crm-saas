import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

const META_GRAPH_VERSION = 'v20.0'

type DebugTokenResponse = {
  data?: {
    app_id?: string
    type?: string
    application?: string
    data_access_expires_at?: number
    expires_at?: number
    is_valid?: boolean
    issued_at?: number
    scopes?: string[]
    user_id?: string
  }
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

  const appId = process.env.META_INSTAGRAM_APP_ID
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: 'Credenciais Meta não configuradas.' },
      { status: 500 }
    )
  }

  const appAccessToken = `${appId}|${appSecret}`

  const params = new URLSearchParams({
    input_token: accessToken,
    access_token: appAccessToken,
  })

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token?${params.toString()}`,
    {
      method: 'GET',
      cache: 'no-store',
    }
  )

  const data = (await response.json()) as DebugTokenResponse

  if (!response.ok) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao consultar debug_token.',
        details: data.error?.message || data,
      },
      { status: 500 }
    )
  }

  const scopes = data.data?.scopes ?? []

  return NextResponse.json({
    success: true,
    token: {
      appId: data.data?.app_id || '',
      application: data.data?.application || '',
      type: data.data?.type || '',
      isValid: Boolean(data.data?.is_valid),
      userId: data.data?.user_id || '',
      expiresAt: data.data?.expires_at || null,
      dataAccessExpiresAt: data.data?.data_access_expires_at || null,
    },
    permissions: {
      scopes,
      hasPagesShowList: scopes.includes('pages_show_list'),
      hasPagesReadEngagement: scopes.includes('pages_read_engagement'),
      hasInstagramBasic: scopes.includes('instagram_basic'),
      hasInstagramManageMessages: scopes.includes('instagram_manage_messages'),
    },
  })
}