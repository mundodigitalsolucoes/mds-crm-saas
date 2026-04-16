// src/app/api/integrations/chatwoot/team-members/route.ts
// Adiciona agente a um time no Chatwoot
// POST { teamId, agentIds[] }

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'
import {
  addChatwootTeamMembers,
  getChatwootCredentials,
} from '@/lib/chatwoot'

const schema = z.object({
  teamId: z.number().int().positive('Team ID inválido'),
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

  const credentials = await getChatwootCredentials(organizationId)
  if (!credentials) {
    return NextResponse.json(
      { error: 'Chatwoot não está conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    await addChatwootTeamMembers(credentials, teamId, agentIds)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao adicionar agente ao time',
      },
      { status: 502 }
    )
  }
}