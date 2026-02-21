// src/app/api/integrations/chatwoot/sso/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/integrations/crypto'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { organizationId } = session.user

    // ── Busca ConnectedAccount Chatwoot da org ────────────────────────────────
    const account = await prisma.connectedAccount.findFirst({
      where  : { organizationId, provider: 'chatwoot' },
      select : { accessToken: true, metadata: true },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Chatwoot não conectado. Configure em Configurações → Integrações.' },
        { status: 404 },
      )
    }

    // ── Descriptografa o api_access_token do agente ──────────────────────────
    let apiToken: string
    try {
      apiToken = await decrypt(account.accessToken)
    } catch {
      return NextResponse.json(
        { error: 'Erro ao descriptografar token do Chatwoot. Reconecte a integração.' },
        { status: 500 },
      )
    }

    if (!apiToken) {
      return NextResponse.json(
        { error: 'Token do Chatwoot inválido. Reconecte a integração.' },
        { status: 500 },
      )
    }

    // ── Resolve URL base do Chatwoot ─────────────────────────────────────────
    const meta = account.metadata as { chatwootUrl?: string } | null
    const chatwootBase =
      meta?.chatwootUrl?.replace(/\/$/, '') ??           // salvo no connect
      process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '') ?? // fallback env
      null

    if (!chatwootBase) {
      return NextResponse.json(
        { error: 'URL do Chatwoot não configurada.' },
        { status: 500 },
      )
    }

    // ── Monta URL de auto-login com token ────────────────────────────────────
    // Chatwoot aceita ?token= desde v2.x — estável entre versões
    const ssoUrl = `${chatwootBase}/app/login?token=${encodeURIComponent(apiToken)}`

    return NextResponse.json({ url: ssoUrl })

  } catch (error) {
    console.error('[CHATWOOT SSO]', error)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
