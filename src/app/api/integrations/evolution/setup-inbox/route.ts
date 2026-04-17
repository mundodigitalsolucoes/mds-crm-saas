// src/app/api/integrations/evolution/setup-inbox/route.ts

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
        'A configuração manual de inbox foi desativada. Use apenas a trilha oficial /api/integrations/evolution/*.',
    },
    { status: 410 }
  )
}