import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

const EVO_URL = process.env.EVOLUTION_API_URL!.replace(/\/$/, '')
const EVO_KEY = process.env.EVOLUTION_API_KEY!

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const account = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { isActive: true, data: true, lastSyncAt: true, lastError: true },
  })

  if (!account || !account.isActive) {
    return NextResponse.json({ connected: false })
  }

  const data = JSON.parse(account.data) as {
    instanceName: string
    serverUrl:    string
    phone:        string | null
    connectedAt:  string | null
  }

  // ── Verifica estado real na Evolution API ────────────────────────────────────
  try {
    const res = await fetch(`${EVO_URL}/instance/connectionState/${data.instanceName}`, {
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(5_000),
    })

    if (!res.ok) {
      // Instância não existe mais na Evolution
      await prisma.connectedAccount.updateMany({
        where: { provider: 'whatsapp', organizationId },
        data:  { isActive: false, lastError: 'Instância não encontrada na Evolution API.' },
      })
      return NextResponse.json({ connected: false })
    }

    const json = await res.json() as {
      instance?: { state?: string }
    }

    const isConnected = json?.instance?.state === 'open'

    // Se conectou agora, busca número do telefone
    let phone = data.phone
    if (isConnected && !phone) {
      try {
        const infoRes = await fetch(`${EVO_URL}/instance/fetchInstances?instanceName=${data.instanceName}`, {
          headers: { apikey: EVO_KEY },
          signal:  AbortSignal.timeout(5_000),
        })
        if (infoRes.ok) {
          const info = await infoRes.json() as Array<{
            instance?: { profileName?: string; wuid?: string }
          }>
          const wuid = info?.[0]?.instance?.wuid ?? null
          if (wuid) {
            // wuid formato: 5517992822597@s.whatsapp.net → extrai número
            phone = wuid.split('@')[0] ?? null
            // Atualiza banco com número
            await prisma.connectedAccount.updateMany({
              where: { provider: 'whatsapp', organizationId },
              data: {
                lastSyncAt: new Date(),
                lastError:  null,
                data: JSON.stringify({ ...data, phone, connectedAt: new Date().toISOString() }),
              },
            })
          }
        }
      } catch {
        // Silencioso — número é opcional
      }
    }

    return NextResponse.json({
      connected:    true,
      isConnected,
      instanceName: data.instanceName,
      phone,
      lastSyncAt:   account.lastSyncAt,
      lastError:    account.lastError,
    })

  } catch {
    return NextResponse.json({
      connected:    true,
      isConnected:  false,
      instanceName: data.instanceName,
      phone:        data.phone,
      lastSyncAt:   account.lastSyncAt,
      lastError:    'Erro ao verificar status.',
    })
  }
}
