// src/app/api/integrations/chatwoot/teams/[teamId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const { teamId } = await params
  const teamIdNum  = Number(teamId)
  if (!teamIdNum || isNaN(teamIdNum)) {
    return NextResponse.json({ error: 'Team ID inválido' }, { status: 400 })
  }

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
    chatwootUrl:       string
    chatwootAccountId: number
  }

  const apiToken    = decryptToken(account.accessTokenEnc)
  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl     = internalUrl ?? chatwootUrl

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/accounts/${chatwootAccountId}/teams/${teamIdNum}`,
      {
        method:  'DELETE',
        headers: { api_access_token: apiToken },
        signal:  AbortSignal.timeout(8_000),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      return NextResponse.json(
        { error: err?.message ?? 'Erro ao excluir time no Chatwoot' },
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
