// src/app/api/integrations/chatwoot/status/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { getChatwootConnectionMeta } from '@/lib/chatwoot'

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const meta = await getChatwootConnectionMeta(organizationId)

  if (!meta.connected) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json(meta)
}