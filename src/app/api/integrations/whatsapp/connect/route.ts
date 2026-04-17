// src/app/api/integrations/whatsapp/connect/route.ts

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
        'A conexão de WhatsApp por connectedAccount legado foi desativada. Use /api/integrations/evolution/connect.',
    },
    { status: 410 }
  )
}