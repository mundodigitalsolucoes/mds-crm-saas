// src/app/api/atendimento/equipes/route.ts
// Lista e cria equipes no Atendimento.
// Não recria fila, roteamento ou engine operacional.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'
import { checkPermission } from '@/lib/checkPermission'
import {
  createChatwootTeam,
  getChatwootCredentials,
  listChatwootTeams,
} from '@/lib/chatwoot'

const createTeamSchema = z.object({
  name: z.string().min(1, 'Nome da equipe obrigatório'),
  description: z.string().optional(),
})

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'view'
  )

  if (!allowed) return errorResponse!

  const credentials = await getChatwootCredentials(session!.user.organizationId)

  if (!credentials) {
    return NextResponse.json({
      connected: false,
      teams: [],
    })
  }

  try {
    const teams = await listChatwootTeams(credentials)

    return NextResponse.json({
      connected: true,
      teams,
      summary: {
        total: teams.length,
      },
    })
  } catch (error) {
    console.error('[ATENDIMENTO EQUIPES] Erro ao listar equipes:', error)

    return NextResponse.json(
      { error: 'Erro ao listar equipes do Atendimento' },
      { status: 502 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'create'
  )

  if (!allowed) return errorResponse!

  const body = await request.json()
  const parsed = parseBody(createTeamSchema, body)

  if (!parsed.success) return parsed.response

  const credentials = await getChatwootCredentials(session!.user.organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Atendimento não conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    const team = await createChatwootTeam(credentials, {
      name: parsed.data.name,
      description: parsed.data.description,
    })

    return NextResponse.json(
      {
        success: true,
        team,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[ATENDIMENTO EQUIPES] Erro ao criar equipe:', error)

    return NextResponse.json(
      { error: 'Erro ao criar equipe no Atendimento' },
      { status: 502 }
    )
  }
}