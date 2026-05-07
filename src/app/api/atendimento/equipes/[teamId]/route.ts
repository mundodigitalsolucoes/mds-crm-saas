// src/app/api/atendimento/equipes/[teamId]/route.ts
// Exclui equipe do Atendimento.
// Não altera fila, roteamento, provider ou engine nativa.

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import {
  deleteChatwootTeam,
  getChatwootCredentials,
} from '@/lib/chatwoot'

function parseTeamId(teamId: string): number | null {
  const parsed = Number(teamId)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'delete'
  )

  if (!allowed) return errorResponse!

  const { teamId } = await params
  const parsedTeamId = parseTeamId(teamId)

  if (!parsedTeamId) {
    return NextResponse.json({ error: 'Equipe inválida' }, { status: 400 })
  }

  const credentials = await getChatwootCredentials(session!.user.organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Atendimento não conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    await deleteChatwootTeam(credentials, parsedTeamId)

    return NextResponse.json({
      success: true,
      teamId: parsedTeamId,
    })
  } catch (error) {
    console.error('[ATENDIMENTO EQUIPE] Erro ao excluir equipe:', error)

    return NextResponse.json(
      { error: 'Erro ao excluir equipe do Atendimento' },
      { status: 502 }
    )
  }
}