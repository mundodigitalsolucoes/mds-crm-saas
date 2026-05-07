// src/app/api/atendimento/inboxes/[inboxId]/members/route.ts
// Vincula agentes a uma inbox/canal do Atendimento.
// Não altera provider, fila, roteamento ou engine nativa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'
import { checkPermission } from '@/lib/checkPermission'
import {
  addChatwootInboxMembers,
  getChatwootCredentials,
} from '@/lib/chatwoot'

const bodySchema = z.object({
  agentIds: z.array(z.number().int().positive()).min(1, 'Informe ao menos um agente'),
})

function parseInboxId(inboxId: string): number | null {
  const parsed = Number(inboxId)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inboxId: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'edit'
  )

  if (!allowed) return errorResponse!

  const { inboxId } = await params
  const parsedInboxId = parseInboxId(inboxId)

  if (!parsedInboxId) {
    return NextResponse.json({ error: 'Inbox inválida' }, { status: 400 })
  }

  const body = await request.json()
  const parsed = parseBody(bodySchema, body)

  if (!parsed.success) return parsed.response

  const credentials = await getChatwootCredentials(session!.user.organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Atendimento não conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    await addChatwootInboxMembers(
      credentials,
      parsedInboxId,
      parsed.data.agentIds
    )

    return NextResponse.json({
      success: true,
      inboxId: parsedInboxId,
      agentIds: parsed.data.agentIds,
    })
  } catch (error) {
    console.error('[ATENDIMENTO INBOX MEMBERS] Erro ao vincular agentes:', error)

    return NextResponse.json(
      { error: 'Erro ao vincular agentes à inbox do Atendimento' },
      { status: 502 }
    )
  }
}