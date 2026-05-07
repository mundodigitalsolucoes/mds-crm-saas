// src/app/api/atendimento/inboxes/route.ts
// Lista inboxes/canais operacionais do Atendimento.
// Não altera provider, roteamento ou engine nativa.

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import {
  getChatwootCredentials,
  listChatwootInboxes,
  normalizeChatwootChannel,
  channelLabel,
} from '@/lib/chatwoot'

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
      inboxes: [],
    })
  }

  try {
    const inboxes = await listChatwootInboxes(credentials)

    return NextResponse.json({
      connected: true,
      inboxes: inboxes.map((inbox) => {
        const channel = normalizeChatwootChannel(inbox.channel_type)

        return {
          id: inbox.id,
          name: inbox.name,
          channel,
          channelLabel: channelLabel(channel),
          channelType: inbox.channel_type ?? null,
        }
      }),
      summary: {
        total: inboxes.length,
      },
    })
  } catch (error) {
    console.error('[ATENDIMENTO INBOXES] Erro ao listar inboxes:', error)

    return NextResponse.json(
      { error: 'Erro ao listar inboxes do Atendimento' },
      { status: 502 }
    )
  }
}