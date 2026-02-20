// src/app/api/integrations/whatsapp/disconnect/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  await prisma.connectedAccount.updateMany({
    where: {
      provider:      'whatsapp',
      organizationId: session!.user.organizationId,
    },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
