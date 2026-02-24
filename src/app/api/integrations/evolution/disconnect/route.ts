// src/app/api/integrations/evolution/disconnect/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

function getEvoConfig() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
  return { EVO_URL: url.replace(/\/$/, ''), EVO_KEY: key }
}

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const { EVO_URL, EVO_KEY } = getEvoConfig()
  const organizationId = session!.user.organizationId

  // ── Busca instância WhatsApp ─────────────────────────────────────────────────
  const waAccount = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { data: true },
  })

  if (!waAccount) {
    return NextResponse.json({ success: true }) // já desconectado
  }

  const waData = JSON.parse(waAccount.data) as {
    instanceName: string
    inboxId?:     number
  }

  // ── 1. Remove inbox do Chatwoot (se existir) ─────────────────────────────────
  if (waData.inboxId) {
    const cwAccount = await prisma.connectedAccount.findUnique({
      where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
      select: { accessTokenEnc: true, data: true },
    })

    if (cwAccount) {
      try {
        const cwData      = JSON.parse(cwAccount.data) as { chatwootUrl: string; chatwootAccountId: number }
        const apiToken    = decryptToken(cwAccount.accessTokenEnc)
        const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
        const baseUrl     = internalUrl ?? cwData.chatwootUrl.replace(/\/$/, '')

        await fetch(
          `${baseUrl}/api/v1/accounts/${cwData.chatwootAccountId}/inboxes/${waData.inboxId}`,
          {
            method:  'DELETE',
            headers: { api_access_token: apiToken },
            signal:  AbortSignal.timeout(8_000),
          }
        )
      } catch {
        // Silencioso — não impede o disconnect do WhatsApp
      }
    }
  }

  // ── 2. Logout na Evolution (desconecta WhatsApp) ─────────────────────────────
  try {
    await fetch(`${EVO_URL}/instance/logout/${waData.instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
  } catch { /* silencioso */ }

  // ── 3. Deleta instância na Evolution ────────────────────────────────────────
  try {
    await fetch(`${EVO_URL}/instance/delete/${waData.instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
  } catch { /* silencioso */ }

  // ── 4. Desativa no banco + limpa inboxId ────────────────────────────────────
  await prisma.connectedAccount.updateMany({
    where: { provider: 'whatsapp', organizationId },
    data:  {
      isActive:  false,
      lastError: null,
      data: JSON.stringify({ instanceName: waData.instanceName, inboxId: null }),
    },
  })

  return NextResponse.json({ success: true })
}
