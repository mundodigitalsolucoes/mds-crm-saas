// src/app/api/integrations/whatsapp/status/route.ts

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'

export async function GET() {
  const { allowed, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  return NextResponse.json(
    {
      error: 'Rota legada congelada.',
      code: 'LEGACY_ROUTE_FROZEN',
      detail:
        'A leitura de status via connectedAccount legado foi desativada. Use /api/integrations/evolution/status.',
    },
    { status: 410 }
  )
}