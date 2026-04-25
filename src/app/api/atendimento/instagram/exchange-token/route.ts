import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { organizationId, code } = body

    if (!organizationId || !code) {
      return NextResponse.json(
        { error: 'organizationId e code são obrigatórios' },
        { status: 400 }
      )
    }

    const appId = process.env.META_INSTAGRAM_APP_ID
    const appSecret = process.env.META_INSTAGRAM_APP_SECRET

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Credenciais Meta não configuradas' },
        { status: 500 }
      )
    }

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/atendimento/instagram/callback`

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code=${code}`,
      {
        method: 'GET',
      }
    )

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Erro ao trocar token', details: tokenData },
        { status: 500 }
      )
    }

    const { access_token } = tokenData

    if (!access_token) {
      return NextResponse.json(
        { error: 'Token não retornado pela Meta' },
        { status: 500 }
      )
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    })

    const parsedSettings = organization?.settings
      ? JSON.parse(organization.settings)
      : {}

    const currentInstagram = parsedSettings.atendimentoInstagram || {}

    const nextSettings = {
      ...parsedSettings,
      atendimentoInstagram: {
        ...currentInstagram,
        status: 'token_received',
        metaAccessTokenPreview: `${access_token.slice(0, 10)}...`,
        metaTokenReceivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      message: 'Token recebido com sucesso',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno', details: error },
      { status: 500 }
    )
  }
}