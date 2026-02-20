// src/app/api/integrations/chatwoot/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'  // ← corrigido

const schema = z.object({
  chatwootUrl:       z.string().url('URL inválida'),
  chatwootAccountId: z.coerce.number().int().positive('Account ID inválido'),
  apiToken:          z.string().min(1, 'Token obrigatório'),
})

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const body = await req.json()                          // ← corrigido
  const parsed = parseBody(schema, body)                 // ← corrigido
  if (!parsed.success) return parsed.response            // ← corrigido (.response, não .error)

  const { chatwootUrl, chatwootAccountId, apiToken } = parsed.data
  const organizationId = session!.user.organizationId

  try {
    const url = `${chatwootUrl.replace(/\/$/, '')}/api/v1/accounts/${chatwootAccountId}/conversations?page=1`
    const res = await fetch(url, {
      headers: { api_access_token: apiToken },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Credenciais inválidas. Verifique a URL, Account ID e Token.' },
        { status: 422 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível conectar ao Chatwoot. Verifique a URL.' },
      { status: 422 }
    )
  }

  const accessTokenEnc = encryptToken(apiToken)

  await prisma.connectedAccount.upsert({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId },
    },
    create: {
      provider:      'chatwoot',
      organizationId,
      connectedById: session!.user.id,
      accessTokenEnc,
      isActive:      true,
      data: JSON.stringify({
        chatwootUrl:       chatwootUrl.replace(/\/$/, ''),
        chatwootAccountId,
      }),
    },
    update: {
      accessTokenEnc,
      isActive:   true,
      lastError:  null,
      lastSyncAt: new Date(),
      data: JSON.stringify({
        chatwootUrl:       chatwootUrl.replace(/\/$/, ''),
        chatwootAccountId,
      }),
    },
  })

  return NextResponse.json({ success: true })
}
