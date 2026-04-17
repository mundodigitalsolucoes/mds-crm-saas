/**
 * src/app/api/integrations/evolution/delete/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import {
  deleteWhatsappChannel,
  ChannelLifecycleError,
} from '@/lib/atendimento/orchestration/channel-lifecycle'

type DeleteBody = {
  instanceId?: string
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''
  const organizationId = session!.user.organizationId
  const userId = session!.user.id
  const body = await req.json().catch(() => ({} as DeleteBody))

  try {
    const result = await deleteWhatsappChannel({
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
      { error: 'Erro ao excluir canal.' },
      { status: 502 }
    )
  }
}