// src/app/api/integrations/chatwoot/teams/route.ts
// Lista e cria times no Chatwoot da organização conectada
// GET → lista times | POST → cria novo time

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'
import {
  createChatwootTeam,
  getChatwootCredentials,
  listChatwootTeams,
} from '@/lib/chatwoot'

const createTeamSchema = z.object({
  name: z.string().min(1, 'Nome do time obrigatório'),
  description: z.string().optional(),
})

// ─── GET /api/integrations/chatwoot/teams ───────────────────────────────────

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const credentials = await getChatwootCredentials(organizationId)

  if (!credentials) {
    return NextResponse.json({ connected: false, teams: [] })
  }

  try {
    const teams = await listChatwootTeams(credentials)
    return NextResponse.json({ connected: true, teams })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao buscar times no Chatwoot',
      },
      { status: 502 }
    )
  }
}

// ─── POST /api/integrations/chatwoot/teams ──────────────────────────────────

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const body = await req.json()
  const parsed = parseBody(createTeamSchema, body)
  if (!parsed.success) return parsed.response

  const organizationId = session!.user.organizationId
  const credentials = await getChatwootCredentials(organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Chatwoot não está conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    const team = await createChatwootTeam(credentials, {
      name: parsed.data.name,
      description: parsed.data.description,
    })

    return NextResponse.json({ team }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao criar time no Chatwoot',
      },
      { status: 502 }
    )
  }
}