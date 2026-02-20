// src/app/api/integrations/chatwoot/status/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: {
        provider: 'chatwoot',
        organizationId,
      },
    },
    select: {
      isActive:   true,
      lastSyncAt: true,
      lastError:  true,
      data:       true,
    },
  })

  if (!account || !account.isActive) {
    return NextResponse.json({ connected: false })
  }

  const data = JSON.parse(account.data) as {
    chatwootUrl:       string
    chatwootAccountId: number
  }

  return NextResponse.json({
    connected:        true,
    chatwootUrl:      data.chatwootUrl,
    chatwootAccountId: data.chatwootAccountId,
    lastSyncAt:       account.lastSyncAt,
    lastError:        account.lastError,
  })
}
