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
    select: { data: true, isActive: true },
  })

  if (!waAccount) {
    console.log('[Disconnect] Nenhuma instância WA encontrada no banco — já desconectado.')
    return NextResponse.json({ success: true })
  }

  const waData = JSON.parse(waAccount.data) as {
    instanceName:     string
    chatwootInboxId?: number | null
  }

  const { instanceName, chatwootInboxId } = waData

  console.log(`[Disconnect] Iniciando disconnect para instância: ${instanceName}`)

  // ── 1. Remove inbox do Chatwoot (se existir) ─────────────────────────────────
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
        console.log(`[Disconnect] Removendo inbox Chatwoot id=${chatwootInboxId} em ${deleteUrl}`)

        const res = await fetch(deleteUrl, {
          method:  'DELETE',
          headers: { api_access_token: apiToken },
          signal:  AbortSignal.timeout(8_000),
        })

        if (res.ok || res.status === 404) {
          // 404 = inbox já não existe — ok
          console.log(`[Disconnect] Inbox Chatwoot removido (status=${res.status})`)
        } else {
          const body = await res.text().catch(() => '')
          console.warn(`[Disconnect] Falha ao remover inbox Chatwoot: status=${res.status} body=${body}`)
        }
      } catch (err) {
        console.warn('[Disconnect] Exceção ao remover inbox Chatwoot (ignorado):', err)
      }
    } else {
      console.log('[Disconnect] Chatwoot não configurado/ativo — pulando remoção do inbox.')
    }
  } else {
    console.log('[Disconnect] chatwootInboxId ausente — nada a remover no Chatwoot.')
  }

  // ── 2. Logout na Evolution ───────────────────────────────────────────────────
  try {
    const res = await fetch(`${EVO_URL}/instance/logout/${instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
    console.log(`[Disconnect] Evolution logout: status=${res.status}`)
  } catch (err) {
    console.warn('[Disconnect] Falha no logout Evolution (ignorado):', err)
  }

  // ── 3. Deleta instância na Evolution ────────────────────────────────────────
  try {
    const res = await fetch(`${EVO_URL}/instance/delete/${instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
    console.log(`[Disconnect] Evolution delete instance: status=${res.status}`)
  } catch (err) {
    console.warn('[Disconnect] Falha ao deletar instância Evolution (ignorado):', err)
  }

  // ── 4. Desativa no banco + limpa chatwootInboxId ─────────────────────────────
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

  console.log(`[Disconnect] Concluído para instância: ${instanceName}`)
  return NextResponse.json({ success: true })
}