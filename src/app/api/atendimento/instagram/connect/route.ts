import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'

const META_OAUTH_BASE_URL = 'https://www.facebook.com/v20.0/dialog/oauth'

function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`)
  }

  return value
}

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'edit'
  )

  if (!allowed) return errorResponse!

  try {
    const appId = getRequiredEnv('META_INSTAGRAM_APP_ID')
    const appUrl = getRequiredEnv('NEXTAUTH_URL')

    const redirectUri = `${appUrl}/api/atendimento/instagram/callback`

    const state = Buffer.from(
      JSON.stringify({
        organizationId: session!.user.organizationId,
        userId: session!.user.id,
        source: 'mds_crm_instagram',
      })
    ).toString('base64url')

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: [
        'pages_show_list',
        'pages_read_engagement',
        'pages_messaging',
        'instagram_basic',
        'instagram_manage_messages',
        'business_management',
      ].join(','),
    })

    return NextResponse.json({
      success: true,
      redirectUrl: `${META_OAUTH_BASE_URL}?${params.toString()}`,
      redirectUri,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Não foi possível iniciar a conexão com o Instagram.',
      },
      { status: 500 }
    )
  }
}