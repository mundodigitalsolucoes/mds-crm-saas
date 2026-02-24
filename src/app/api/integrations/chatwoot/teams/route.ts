// src/app/api/integrations/chatwoot/teams/route.ts
// Lista e cria times no Chatwoot da organização conectada
// GET → lista times | POST → cria novo time

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'

const createTeamSchema = z.object({
  name:        z.string().min(1, 'Nome do time obrigatório'),
  description: z.string().optional(),
})

// ─── helpers ────────────────────────────────────────────────────────────────

async function getChatwootCredentials(organizationId: string) {
  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId },
    },
    select: { isActive: true, accessTokenEnc: true, data: true },
  })

  if (!account || !account.isActive) return null

  const { chatwootUrl, chatwootAccountId } = JSON.parse(account.data) as {
    chatwootUrl: string
    chatwootAccountId: number
  }

  const apiToken = decryptToken(account.accessTokenEnc)

  return { chatwootUrl, chatwootAccountId, apiToken }
}

// ─── GET /api/integrations/chatwoot/teams ───────────────────────────────────

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const creds = await getChatwootCredentials(session!.user.organizationId)
  if (!creds) {
    return NextResponse.json({ connected: false, teams: [] })
  }

  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl     = internalUrl ?? creds.chatwootUrl

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/accounts/${creds.chatwootAccountId}/teams`,
      {
        headers: { api_access_token: creds.apiToken },
        signal:  AbortSignal.timeout(8_000),
      }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar times no Chatwoot' },
        { status: 502 }
      )
    }

    const teams = await res.json()
    return NextResponse.json({ connected: true, teams })
  } catch {
    return NextResponse.json(
      { error: 'Timeout ao conectar com Chatwoot' },
      { status: 504 }
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

  const creds = await getChatwootCredentials(session!.user.organizationId)
  if (!creds) {
    return NextResponse.json(
      { error: 'Chatwoot não está conectado nesta organização' },
      { status: 422 }
    )
  }

  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl     = internalUrl ?? creds.chatwootUrl

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/accounts/${creds.chatwootAccountId}/teams`,
      {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          api_access_token:  creds.apiToken,
        },
        body:   JSON.stringify({
          name:        parsed.data.name,
          description: parsed.data.description ?? '',
        }),
        signal: AbortSignal.timeout(8_000),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err?.message ?? 'Erro ao criar time no Chatwoot' },
        { status: 502 }
      )
    }

    const team = await res.json()
    return NextResponse.json({ team }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Timeout ao conectar com Chatwoot' },
      { status: 504 }
    )
  }
}
