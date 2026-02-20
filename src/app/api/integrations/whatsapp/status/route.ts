// src/app/api/integrations/whatsapp/status/route.ts
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
        provider: 'whatsapp',
        organizationId,
      },
    },
    select: {
      isActive:       true,
      accessTokenEnc: true,
      data:           true,
      lastSyncAt:     true,
      lastError:      true,
    },
  })

  if (!account || !account.isActive) {
    return NextResponse.json({ connected: false })
  }

  const data = JSON.parse(account.data) as {
    serverUrl:    string
    instanceName: string
  }

  // Verificar estado real da instância
  try {
    const apiKey = decryptToken(account.accessTokenEnc)
    const url    = `${data.serverUrl}/instance/connectionState/${data.instanceName}`
    const res    = await fetch(url, {
      headers: { apikey: apiKey },
      signal:  AbortSignal.timeout(5_000),
    })

    if (res.ok) {
      const json        = await res.json() as { instance?: { state?: string } }
      const isConnected = json?.instance?.state === 'open'

      return NextResponse.json({
        connected:    true,
        isConnected,
        serverUrl:    data.serverUrl,
        instanceName: data.instanceName,
        lastSyncAt:   account.lastSyncAt,
      })
    }
  } catch {
    // Se falhou ao verificar estado, retorna conectado mas com aviso
  }

  return NextResponse.json({
    connected:    true,
    isConnected:  false,
    serverUrl:    data.serverUrl,
    instanceName: data.instanceName,
    lastSyncAt:   account.lastSyncAt,
    lastError:    account.lastError,
  })
}
