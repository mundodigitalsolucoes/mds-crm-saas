// src/app/api/integrations/chatwoot/sso/route.ts
//
// Gera token de sessão Devise do Chatwoot para SSO no iframe.
// Faz POST /auth/sign_in no Chatwoot com as credenciais do owner
// e retorna os tokens necessários para autenticação no frontend.

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: {
        provider: 'chatwoot',
        organizationId,
      },
    },
    select: { isActive: true, data: true },
  })

  if (!account?.isActive) {
    return NextResponse.json({ error: 'chatwoot_not_configured' }, { status: 404 })
  }

  const data = JSON.parse(account.data) as {
    chatwootUrl:       string
    chatwootAccountId: number
    ownerEmail?:       string
    ownerPasswordEnc?: string
  }

  if (!data.ownerEmail || !data.ownerPasswordEnc) {
    return NextResponse.json({ error: 'credentials_not_stored' }, { status: 404 })
  }

  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl     = internalUrl ?? data.chatwootUrl.replace(/\/$/, '')

  let password: string
  try {
    password = decryptToken(data.ownerPasswordEnc)
  } catch {
    return NextResponse.json({ error: 'decrypt_failed' }, { status: 500 })
  }

  try {
    const res = await fetch(`${baseUrl}/auth/sign_in`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: data.ownerEmail, password }),
      signal:  AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.warn('[ChatwootSSO] sign_in falhou:', res.status)
      return NextResponse.json({ error: 'sign_in_failed' }, { status: 401 })
    }

    // Extrai os headers Devise Token Auth da resposta
    const accessToken = res.headers.get('access-token')
    const client      = res.headers.get('client')
    const uid         = res.headers.get('uid')
    const tokenType   = res.headers.get('token-type') ?? 'Bearer'

    if (!accessToken || !client || !uid) {
      console.warn('[ChatwootSSO] Headers Devise ausentes na resposta')
      return NextResponse.json({ error: 'missing_headers' }, { status: 500 })
    }

    return NextResponse.json({
      accessToken,
      client,
      uid,
      tokenType,
      chatwootUrl:       data.chatwootUrl,
      chatwootAccountId: data.chatwootAccountId,
    })
  } catch (err) {
    console.error('[ChatwootSSO] Erro:', err)
    return NextResponse.json({ error: 'unexpected_error' }, { status: 500 })
  }
}