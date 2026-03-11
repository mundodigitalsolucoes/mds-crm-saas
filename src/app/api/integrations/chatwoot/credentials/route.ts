// src/app/api/integrations/chatwoot/credentials/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

export async function GET() {
  const perm = await checkPermission('integrations', 'view')
  if (!perm.allowed || !perm.session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const account = await prisma.connectedAccount.findFirst({
    where: { organizationId: perm.session.user.organizationId, provider: 'chatwoot' },
  })
  if (!account) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 })
  }

  const data = JSON.parse(account.data) as Record<string, string>
  if (!data?.chatwootAccountId) {
    return NextResponse.json({ error: 'no_credentials' }, { status: 404 })
  }

  const chatwootUrl = process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '')
                   || data.chatwootUrl
                   || 'https://app.mundodigitalsolucoes.com.br'

  const email    = data.ownerEmail
  const password = data.ownerPasswordEnc ? decryptToken(data.ownerPasswordEnc) : ''

  // Confirma o usuário automaticamente antes de retornar as credenciais
  // Garante que mesmo usuários não confirmados consigam logar
  const secret = process.env.CHATWOOT_SUPER_ADMIN_TOKEN
  if (secret && email) {
    try {
      const confirmRes = await fetch(
        `${chatwootUrl}/sso/confirm-user?email=${encodeURIComponent(email)}&secret=${encodeURIComponent(secret)}`,
        { signal: AbortSignal.timeout(5_000) }
      )
      if (confirmRes.ok) {
        console.info(`[CREDENTIALS] Usuário ${email} confirmado`)
      }
    } catch {
      // Silencioso — não bloqueia o carregamento do iframe
    }
  }

  return NextResponse.json({
    email,
    password,
    chatwootUrl,
    chatwootAccountId: Number(data.chatwootAccountId),
  })
}