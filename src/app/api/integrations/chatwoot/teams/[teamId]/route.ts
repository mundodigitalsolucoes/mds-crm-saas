// src/app/api/integrations/chatwoot/teams/[teamId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import {
  deleteChatwootTeam,
  getChatwootCredentials,
} from '@/lib/chatwoot'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const { teamId } = await params
  const teamIdNum = Number(teamId)

  if (!teamIdNum || Number.isNaN(teamIdNum)) {
    return NextResponse.json({ error: 'Team ID inválido' }, { status: 400 })
  }

  const organizationId = session!.user.organizationId
  const credentials = await getChatwootCredentials(organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Chatwoot não está conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    await deleteChatwootTeam(credentials, teamIdNum)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao excluir time no Chatwoot',
      },
      { status: 502 }
    )
  }
}