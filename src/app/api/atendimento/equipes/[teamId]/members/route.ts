// src/app/api/atendimento/equipes/[teamId]/members/route.ts
// Adiciona ou remove agentes de uma equipe no Atendimento.
// Não recria roteamento, fila ou engine operacional.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'
import { checkPermission } from '@/lib/checkPermission'
import {
  addChatwootTeamMembers,
  getChatwootCredentials,
  removeChatwootTeamMember,
} from '@/lib/chatwoot'

const memberSchema = z.object({
  agentId: z.number().int().positive('agentId inválido'),
})

function parseTeamId(teamId: string): number | null {
  const parsed = Number(teamId)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'edit'
  )

  if (!allowed) return errorResponse!

  const { teamId } = await params
  const parsedTeamId = parseTeamId(teamId)

  if (!parsedTeamId) {
    return NextResponse.json({ error: 'Equipe inválida' }, { status: 400 })
  }

  const body = await request.json()
  const parsed = parseBody(memberSchema, body)

  if (!parsed.success) return parsed.response

  const credentials = await getChatwootCredentials(session!.user.organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Atendimento não conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    await addChatwootTeamMembers(credentials, parsedTeamId, [parsed.data.agentId])

    return NextResponse.json({
      success: true,
      teamId: parsedTeamId,
      agentId: parsed.data.agentId,
    })
  } catch (error) {
    console.error('[ATENDIMENTO EQUIPE MEMBERS] Erro ao adicionar agente:', error)

    return NextResponse.json(
      { error: 'Erro ao adicionar agente na equipe do Atendimento' },
      { status: 502 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'edit'
  )

  if (!allowed) return errorResponse!

  const { teamId } = await params
  const parsedTeamId = parseTeamId(teamId)

  if (!parsedTeamId) {
    return NextResponse.json({ error: 'Equipe inválida' }, { status: 400 })
  }

  const body = await request.json()
  const parsed = parseBody(memberSchema, body)

  if (!parsed.success) return parsed.response

  const credentials = await getChatwootCredentials(session!.user.organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Atendimento não conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    await removeChatwootTeamMember(credentials, parsedTeamId, parsed.data.agentId)

    return NextResponse.json({
      success: true,
      teamId: parsedTeamId,
      agentId: parsed.data.agentId,
    })
  } catch (error) {
    console.error('[ATENDIMENTO EQUIPE MEMBERS] Erro ao remover agente:', error)

    return NextResponse.json(
      { error: 'Erro ao remover agente da equipe do Atendimento' },
      { status: 502 }
    )
  }
}