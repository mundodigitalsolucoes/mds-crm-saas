// src/app/api/integrations/chatwoot/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'
import { validateChatwootCredentials } from '@/lib/chatwoot'

const schema = z.object({
  chatwootUrl: z.string().url('URL inválida'),
  chatwootAccountId: z.coerce.number().int().positive('Account ID inválido'),
  apiToken: z.string().min(1, 'Token obrigatório'),
})

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const body = await req.json()
  const parsed = parseBody(schema, body)
  if (!parsed.success) return parsed.response

  const { chatwootUrl, chatwootAccountId, apiToken } = parsed.data
  const organizationId = session!.user.organizationId

  const isValid = await validateChatwootCredentials({
    chatwootUrl,
    accountId: chatwootAccountId,
    token: apiToken,
  })

  if (!isValid) {
    return NextResponse.json(
      { error: 'Credenciais inválidas. Verifique a URL, Account ID e Token.' },
      { status: 422 }
    )
  }

  const accessTokenEnc = encryptToken(apiToken)
  const normalizedPublicUrl = chatwootUrl.replace(/\/$/, '')

  await prisma.connectedAccount.upsert({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId },
    },
    create: {
      provider: 'chatwoot',
      organizationId,
      connectedById: session!.user.id,
      accessTokenEnc,
      isActive: true,
      data: JSON.stringify({
        chatwootUrl: normalizedPublicUrl,
        chatwootAccountId,
      }),
    },
    update: {
      accessTokenEnc,
      isActive: true,
      lastError: null,
      lastSyncAt: new Date(),
      data: JSON.stringify({
        chatwootUrl: normalizedPublicUrl,
        chatwootAccountId,
      }),
    },
  })

  return NextResponse.json({ success: true })
}