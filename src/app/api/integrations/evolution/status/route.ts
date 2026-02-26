/**
 * src/app/api/integrations/evolution/status/route.ts
 *
 * Verifica status do WhatsApp da organização.
 * Retorna isConnected=false com disconnectedAt quando a instância cai,
 * permitindo que o frontend mostre notificação visual.
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { getInstanceState, fetchInstanceInfo } from '@/lib/integrations/evolutionClient'

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
    instanceName:    string
    serverUrl:       string
    phone:           string | null
    connectedAt:     string | null
    disconnectedAt?: string | null
  }

  // ── Verifica estado real na Evolution ────────────────────────────────────────
  const state = await getInstanceState(data.instanceName)

  if (state === 'not_found') {
    // Instância sumiu da Evolution → marca como inativa no banco
    await prisma.connectedAccount.updateMany({
      where: { provider: 'whatsapp', organizationId },
      data:  {
        isActive:  false,
        lastError: 'Instância não encontrada na Evolution API.',
        data:      JSON.stringify({ ...data, disconnectedAt: new Date().toISOString() }),
      },
    })
    return NextResponse.json({ connected: false, lostConnection: true })
  }

  const isConnected = state === 'open'

  // ── Se conectado e sem número, tenta buscar ──────────────────────────────────
  let phone = data.phone
  if (isConnected && !phone) {
    try {
      const info = await fetchInstanceInfo(data.instanceName)
      const wuid = info?.instance?.wuid ?? null
      if (wuid) {
        phone = wuid.split('@')[0] ?? null
        await prisma.connectedAccount.updateMany({
          where: { provider: 'whatsapp', organizationId },
          data: {
            lastSyncAt: new Date(),
            lastError:  null,
            data:       JSON.stringify({
              ...data,
              phone,
              connectedAt:     new Date().toISOString(),
              disconnectedAt:  null,
            }),
          },
        })
      }
    } catch {
      // Número é opcional — silencioso
    }
  }

  // ── Se desconectou (celular sem internet, etc.) → salva disconnectedAt ───────
  if (!isConnected && !data.disconnectedAt) {
    await prisma.connectedAccount.updateMany({
      where: { provider: 'whatsapp', organizationId },
      data: {
        lastError: 'WhatsApp desconectado. Verifique o celular.',
        data:      JSON.stringify({ ...data, disconnectedAt: new Date().toISOString() }),
      },
    })
  }

  // ── Se reconectou → limpa disconnectedAt ────────────────────────────────────
  if (isConnected && data.disconnectedAt) {
    await prisma.connectedAccount.updateMany({
      where: { provider: 'whatsapp', organizationId },
      data: {
        lastError: null,
        data:      JSON.stringify({ ...data, disconnectedAt: null, connectedAt: new Date().toISOString() }),
      },
    })
  }

  return NextResponse.json({
    connected:      true,
    isConnected,
    instanceName:   data.instanceName,
    phone,
    connectedAt:    data.connectedAt,
    disconnectedAt: isConnected ? null : (data.disconnectedAt ?? new Date().toISOString()),
    lastSyncAt:     account.lastSyncAt,
    lastError:      account.lastError,
  })
}