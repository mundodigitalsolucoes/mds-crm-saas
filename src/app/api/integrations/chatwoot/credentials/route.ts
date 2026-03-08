import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

export async function GET() {
  const perm = await checkPermission('integrations', 'view')
  if (!perm.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const account = await prisma.connectedAccount.findFirst({
    where: { organizationId: perm.organizationId, type: 'chatwoot' },
  })
  if (!account) return NextResponse.json({ error: 'not_configured' }, { status: 404 })

  const data = account.data as Record<string, string>
  if (!data?.ownerEmail || !data?.ownerPasswordEnc) {
    return NextResponse.json({ error: 'no_credentials' }, { status: 404 })
  }

  const password = decryptToken(data.ownerPasswordEnc)
  const chatwootUrl = process.env.CHATWOOT_URL || 'https://app.mundodigitalsolucoes.com.br'

  return NextResponse.json({
    email:            data.ownerEmail,
    password,
    chatwootUrl,
    chatwootAccountId: Number(data.chatwootAccountId || account.externalId),
  })
}