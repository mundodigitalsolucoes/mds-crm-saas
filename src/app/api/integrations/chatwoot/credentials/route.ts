// src/app/api/integrations/chatwoot/credentials/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

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

  return NextResponse.json({
    email:             data.ownerEmail,
    chatwootUrl,
    chatwootAccountId: Number(data.chatwootAccountId),
  })
}