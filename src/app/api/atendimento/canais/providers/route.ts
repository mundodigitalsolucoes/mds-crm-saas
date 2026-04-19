// src/app/api/atendimento/canais/providers/route.ts

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { listWhatsappProviders } from '@/lib/atendimento/providers'

export async function GET() {
  const { allowed, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  return NextResponse.json({
    providers: listWhatsappProviders(),
  })
}