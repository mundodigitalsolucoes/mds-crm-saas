// src/app/api/integrations/whatsapp/create-inbox/route.ts

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'

export async function POST() {
  const { allowed, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  return NextResponse.json(
    {
      error: 'Rota legada congelada.',
      code: 'LEGACY_ROUTE_FROZEN',
      detail:
        'A criação manual de inbox pela trilha antiga foi desativada. O vínculo Chatwoot ⇄ Evolution agora segue somente a trilha oficial do canal.',
    },
    { status: 410 }
  )
}