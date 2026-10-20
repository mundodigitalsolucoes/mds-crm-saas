import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/checkPermission'
import { observeChannelEntitlement } from '@/lib/authorization/channel-observation'

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!
  const trustedOrganizationId = session!.user.organizationId
  await observeChannelEntitlement(trustedOrganizationId, 'instagram_channel')

  try {
    const body = await req.json()

    const { organizationId, code } = body ?? {}

    if (organizationId !== trustedOrganizationId) {
      return NextResponse.json({ error: 'Organização inválida' }, { status: 403 })
    }

    if (!organizationId || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { error: 'organizationId e code são obrigatórios' },
        { status: 400 }
      )
    }

    // Confirm the authenticated tenant is active before exchanging a Meta code.
    const organization = await prisma.organization.findFirst({
      where: { id: trustedOrganizationId, deletedAt: null },
      select: { settings: true },
    })
    if (!organization) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
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
        { error: 'Erro ao trocar token' },
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

    const parsedSettings = organization?.settings
      ? JSON.parse(organization.settings)
      : {}

    const currentInstagram = parsedSettings.atendimentoInstagram || {}

    // Never replace the settings snapshot owned by unresolved inbox provisioning.
    if (['pending', 'reconciliation_required'].includes(String(currentInstagram.inboxProvisionStatus))) {
      return NextResponse.json(
        { error: 'Provisionamento da inbox pendente de reconciliação.' },
        { status: 409 }
      )
    }

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

    // Do not overwrite a concurrent settings update or resurrect a deleted tenant.
    const saved = await prisma.organization.updateMany({
      where: {
        id: trustedOrganizationId,
        deletedAt: null,
        settings: organization.settings,
      },
      data: {
        settings: JSON.stringify(nextSettings),
      },
    })
    if (saved.count !== 1) {
      return NextResponse.json({ error: 'Configuração alterada; tente novamente' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      message: 'Token recebido com sucesso',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}