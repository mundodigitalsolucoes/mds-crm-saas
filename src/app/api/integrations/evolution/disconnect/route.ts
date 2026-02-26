/**
 * src/app/api/integrations/evolution/disconnect/route.ts
 *
 * Desconecta o WhatsApp da organização:
 *  1. Remove inbox do Chatwoot
 *  2. Logout + delete instância na Evolution (via evolutionClient)
 *  3. Desativa no banco
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'
import { disconnectInstance } from '@/lib/integrations/evolutionClient'

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const organizationId = session!.user.organizationId

  const waAccount = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { data: true, isActive: true },
  })

  if (!waAccount) {
    console.log('[Disconnect] Nenhuma instância WA no banco — já desconectado.')
    return NextResponse.json({ success: true })
  }

  const waData = JSON.parse(waAccount.data) as {
    instanceName:     string
    chatwootInboxId?: number | null
  }

  const { instanceName, chatwootInboxId } = waData
  console.log(`[Disconnect] Iniciando disconnect para: ${instanceName}`)

  // ── 1. Remove inbox do Chatwoot ──────────────────────────────────────────────
  if (chatwootInboxId) {
    const cwAccount = await prisma.connectedAccount.findUnique({
      where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
      select: { accessTokenEnc: true, data: true, isActive: true },
    })

    if (cwAccount?.isActive) {
      try {
        const cwData      = JSON.parse(cwAccount.data) as { chatwootUrl: string; chatwootAccountId: number }
        const apiToken    = decryptToken(cwAccount.accessTokenEnc)
        const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
        const baseUrl     = internalUrl ?? cwData.chatwootUrl.replace(/\/$/, '')

        const deleteUrl = `${baseUrl}/api/v1/accounts/${cwData.chatwootAccountId}/inboxes/${chatwootInboxId}`
        console.log(`[Disconnect] Removendo inbox Chatwoot id=${chatwootInboxId}`)

        const res = await fetch(deleteUrl, {
          method:  'DELETE',
          headers: { api_access_token: apiToken },
          signal:  AbortSignal.timeout(8_000),
        })

        if (res.ok || res.status === 404) {
          console.log(`[Disconnect] Inbox Chatwoot removido (status=${res.status})`)
        } else {
          const body = await res.text().catch(() => '')
          console.warn(`[Disconnect] Falha ao remover inbox: status=${res.status} body=${body}`)
        }
      } catch (err) {
        console.warn('[Disconnect] Exceção ao remover inbox Chatwoot (ignorado):', err)
      }
    }
  }

  // ── 2. Logout + delete na Evolution (via evolutionClient) ────────────────────
  await disconnectInstance(instanceName)
  console.log(`[Disconnect] Evolution logout+delete concluído para: ${instanceName}`)

  // ── 3. Desativa no banco ─────────────────────────────────────────────────────
  await prisma.connectedAccount.updateMany({
    where: { provider: 'whatsapp', organizationId },
    data:  {
      isActive:  false,
      lastError: null,
      data:      JSON.stringify({
        instanceName,
        chatwootInboxId: null,
        phone:           null,
        connectedAt:     null,
        serverUrl:       EVO_URL,
      }),
    },
  })

  console.log(`[Disconnect] Concluído para: ${instanceName}`)
  return NextResponse.json({ success: true })
}