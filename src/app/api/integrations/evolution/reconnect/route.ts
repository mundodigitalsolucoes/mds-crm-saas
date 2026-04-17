/**
 * src/app/api/integrations/evolution/reconnect/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import {
  reconnectWhatsappChannel,
  ChannelLifecycleError,
} from '@/lib/atendimento/orchestration/channel-lifecycle'

type ReconnectBody = {
  instanceId?: string
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''

  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json(
      { error: 'Servidor WhatsApp não configurado.' },
      { status: 500 }
    )
  }

  const organizationId = session!.user.organizationId
  const userId = session!.user.id
  const body = await req.json().catch(() => ({} as ReconnectBody))

  try {
    const result = await reconnectWhatsappChannel({
      organizationId,
      userId,
      instanceId: body.instanceId,
      evoUrl: EVO_URL,
      evoKey: EVO_KEY,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ChannelLifecycleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao reconectar instância WhatsApp.' },
      { status: 502 }
    )
  }
}