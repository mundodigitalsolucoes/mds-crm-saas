// src/app/api/integrations/chatwoot/team-members/route.ts
// Adiciona agente a um time no Chatwoot
// POST { teamId, agentIds[] }

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'

const schema = z.object({
  teamId:   z.number().int().positive('Team ID inválido'),
  agentIds: z.array(z.number().int().positive()).min(1, 'Informe ao menos um agente'),
})

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const body = await req.json()
  const parsed = parseBody(schema, body)
  if (!parsed.success) return parsed.response

  const { teamId, agentIds } = parsed.data
  const organizationId = session!.user.organizationId

  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId },
    },
    select: { isActive: true, accessTokenEnc: true, data: true },
  })

  if (!account || !account.isActive) {
    return NextResponse.json(
      { error: 'Chatwoot não está conectado nesta organização' },
      { status: 422 }
    )
  }

  const { chatwootUrl, chatwootAccountId } = JSON.parse(account.data) as {
    chatwootUrl: string
    chatwootAccountId: number
  }
  const apiToken   = decryptToken(account.accessTokenEnc)
  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl     = internalUrl ?? chatwootUrl

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/accounts/${chatwootAccountId}/teams/${teamId}/team_members`,
      {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          api_access_token: apiToken,
        },
        body:   JSON.stringify({ user_ids: agentIds }),
        signal: AbortSignal.timeout(8_000),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err?.message ?? 'Erro ao adicionar agente ao time' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Timeout ao conectar com Chatwoot' },
      { status: 504 }
    )
  }
}
