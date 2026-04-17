/**
 * src/app/api/integrations/evolution/disconnect/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import {
  disconnectWhatsappChannel,
  ChannelLifecycleError,
} from '@/lib/atendimento/orchestration/channel-lifecycle'

type DisconnectBody = {
  instanceId?: string
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''
  const organizationId = session!.user.organizationId
  const userId = session!.user.id
  const body = await req.json().catch(() => ({} as DisconnectBody))

  try {
    const result = await disconnectWhatsappChannel({
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
      { error: 'Erro ao desconectar instância WhatsApp.' },
      { status: 502 }
    )
  }
}