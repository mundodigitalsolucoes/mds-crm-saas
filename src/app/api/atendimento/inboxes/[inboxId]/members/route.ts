// src/app/api/atendimento/inboxes/[inboxId]/members/route.ts
// Lista, vincula e remove agentes de uma inbox/canal do Atendimento.
// Não altera provider, fila, roteamento ou engine nativa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'
import { checkPermission } from '@/lib/checkPermission'
import {
  addChatwootInboxMembers,
  getChatwootCredentials,
  listChatwootInboxMembers,
  removeChatwootInboxMembers,
} from '@/lib/chatwoot'

const bodySchema = z.object({
  agentIds: z
    .array(z.number().int().positive())
    .min(1, 'Informe ao menos um agente'),
})

function parseInboxId(inboxId: string): number | null {
  const parsed = Number(inboxId)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Erro desconhecido'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ inboxId: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission(
    'atendimento',
    'view'
  )

  if (!allowed) return errorResponse!

  const { inboxId } = await params
  const parsedInboxId = parseInboxId(inboxId)

  if (!parsedInboxId) {
    return NextResponse.json({ error: 'Inbox inválida' }, { status: 400 })
  }

  const credentials = await getChatwootCredentials(session!.user.organizationId)

  if (!credentials) {
    return NextResponse.json(
      { error: 'Atendimento não conectado nesta organização' },
      { status: 422 }
    )
  }

  try {
    const members = await listChatwootInboxMembers(credentials, parsedInboxId)

    return NextResponse.json({
      connected: true,
      inboxId: parsedInboxId,
      members,
      memberIds: members.map((member) => member.id),
      summary: {
        total: members.length,
      },
    })
  } catch (error) {
    console.error('[ATENDIMENTO INBOX MEMBERS] Erro ao listar agentes:', error)

    return NextResponse.json(
      {
        error: 'Erro ao listar agentes da inbox do Atendimento',
        detail: errorMessage(error),
      },
      { status: 502 }
    )
  }
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

    const members = await listChatwootInboxMembers(credentials, parsedInboxId)

    return NextResponse.json({
      success: true,
      inboxId: parsedInboxId,
      agentIds: parsed.data.agentIds,
      memberIds: members.map((member) => member.id),
      summary: {
        total: members.length,
      },
    })
  } catch (error) {
    console.error('[ATENDIMENTO INBOX MEMBERS] Erro ao vincular agentes:', error)

    const members = await listChatwootInboxMembers(
      credentials,
      parsedInboxId
    ).catch(() => null)

    if (
      members &&
      parsed.data.agentIds.every((agentId) =>
        members.some((member) => member.id === agentId)
      )
    ) {
      return NextResponse.json({
        success: true,
        inboxId: parsedInboxId,
        agentIds: parsed.data.agentIds,
        memberIds: members.map((member) => member.id),
        summary: {
          total: members.length,
        },
        recoveredFromInvalidResponse: true,
      })
    }

    return NextResponse.json(
      {
        error: 'Erro ao vincular agentes à inbox do Atendimento',
        detail: errorMessage(error),
      },
      { status: 502 }
    )
  }
}

export async function DELETE(
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
    await removeChatwootInboxMembers(
      credentials,
      parsedInboxId,
      parsed.data.agentIds
    )

    const members = await listChatwootInboxMembers(credentials, parsedInboxId)

    return NextResponse.json({
      success: true,
      inboxId: parsedInboxId,
      agentIds: parsed.data.agentIds,
      memberIds: members.map((member) => member.id),
      summary: {
        total: members.length,
      },
    })
  } catch (error) {
    console.error('[ATENDIMENTO INBOX MEMBERS] Erro ao remover agentes:', error)

    const members = await listChatwootInboxMembers(
      credentials,
      parsedInboxId
    ).catch(() => null)

    if (
      members &&
      parsed.data.agentIds.every(
        (agentId) => !members.some((member) => member.id === agentId)
      )
    ) {
      return NextResponse.json({
        success: true,
        inboxId: parsedInboxId,
        agentIds: parsed.data.agentIds,
        memberIds: members.map((member) => member.id),
        summary: {
          total: members.length,
        },
        recoveredFromInvalidResponse: true,
      })
    }

    return NextResponse.json(
      {
        error: 'Erro ao remover agentes da inbox do Atendimento',
        detail: errorMessage(error),
      },
      { status: 502 }
    )
  }
}