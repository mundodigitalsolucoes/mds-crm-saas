/**
 * src/app/api/integrations/evolution/status/route.ts
 *
 * Status global para banner do app.
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { readWhatsappGlobalStatus } from '@/lib/atendimento/orchestration/channel-status'

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const status = await readWhatsappGlobalStatus(organizationId)

  return NextResponse.json(status)
}