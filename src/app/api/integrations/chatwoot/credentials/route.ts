// src/app/api/integrations/chatwoot/credentials/route.ts
// Faz sign_in server-side no Chatwoot e retorna token fresco
// Sem CORS — é servidor Next.js chamando servidor Chatwoot diretamente

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

export async function GET() {
  const perm = await checkPermission('integrations', 'view')
  if (!perm.allowed || !perm.session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Busca credenciais da org
  const account = await prisma.connectedAccount.findFirst({
    where: { organizationId: perm.session.user.organizationId, provider: 'chatwoot' },
  })
  if (!account) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 })
  }

  const data = JSON.parse(account.data) as Record<string, string>
  if (!data?.ownerEmail || !data?.ownerPasswordEnc || !data?.chatwootAccountId) {
    return NextResponse.json({ error: 'no_credentials' }, { status: 404 })
  }

  const chatwootUrl = process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '') 
                   || data.chatwootUrl 
                   || 'https://app.mundodigitalsolucoes.com.br'

  const email    = data.ownerEmail
  const password = decryptToken(data.ownerPasswordEnc)

  // Sign_in server-side — sem CORS, token sempre fresco
  try {
    const signInRes = await fetch(`${chatwootUrl}/auth/sign_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!signInRes.ok) {
      console.error('[CHATWOOT CREDENTIALS] sign_in falhou:', signInRes.status)
      return NextResponse.json({ error: 'auth_failed' }, { status: 502 })
    }

    const json = await signInRes.json()
    const d    = json?.data

    // Token pode vir no header ou no body
    const accessToken = signInRes.headers.get('access-token') || d?.access_token

    if (!accessToken) {
      return NextResponse.json({ error: 'no_token' }, { status: 502 })
    }

    return NextResponse.json({
      accessToken,
      chatwootUrl,
      chatwootAccountId: Number(data.chatwootAccountId),
    })
  } catch (err) {
    console.error('[CHATWOOT CREDENTIALS] Erro:', err)
    return NextResponse.json({ error: 'connection_failed' }, { status: 502 })
  }
}