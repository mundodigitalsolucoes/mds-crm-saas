// src/app/api/integrations/chatwoot/status/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

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
      isActive:       true,
      lastSyncAt:     true,
      lastError:      true,
      data:           true,
      accessTokenEnc: true,
    },
  })

  if (!account || !account.isActive) {
    return NextResponse.json({ connected: false })
  }

  const data = JSON.parse(account.data) as {
    chatwootUrl:       string
    chatwootAccountId: number
  }

  // Descriptografa o access_token do usuário para SSO no iframe
  let accessToken: string | null = null
  try {
    accessToken = decryptToken(account.accessTokenEnc)
  } catch {
    console.warn('[ChatwootStatus] Falha ao descriptografar token')
  }

  return NextResponse.json({
    connected:         true,
    chatwootUrl:       data.chatwootUrl,
    chatwootAccountId: data.chatwootAccountId,
    accessToken,
    lastSyncAt:        account.lastSyncAt,
    lastError:         account.lastError,
  })
}