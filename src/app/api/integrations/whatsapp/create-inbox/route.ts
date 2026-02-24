// src/app/api/integrations/whatsapp/create-inbox/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

interface EvoData {
  serverUrl:       string
  instanceName:    string
  chatwootInboxId?: number
}

interface CwData {
  chatwootUrl:       string
  chatwootAccountId: number
}

interface EvoSetChatwootResponse {
  chatwoot?: {
    accountId?: number
    nameInbox?: string
    enabled?:   boolean
  }
}

interface CwInbox {
  id:   number
  name: string
}

interface CwInboxListResponse {
  payload: CwInbox[]
}

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  // ── 1. Busca ConnectedAccount do WhatsApp ──────────────────────────────────
  const waAccount = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { data: true, isActive: true },
  })

  if (!waAccount?.isActive) {
    return NextResponse.json({ inboxCreated: false, reason: 'whatsapp_not_connected' })
  }

  const waData = JSON.parse(waAccount.data) as EvoData
  const { serverUrl, instanceName } = waData

  if (!serverUrl || !instanceName) {
    return NextResponse.json({ inboxCreated: false, reason: 'whatsapp_data_incomplete' })
  }

  // ── 2. Busca ConnectedAccount do Chatwoot ──────────────────────────────────
  const cwAccount = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { data: true, accessTokenEnc: true, isActive: true },
  })

  if (!cwAccount?.isActive) {
    return NextResponse.json({ inboxCreated: false, reason: 'chatwoot_not_configured' })
  }

  const cwData      = JSON.parse(cwAccount.data) as CwData
  const chatwootUrl = cwData.chatwootUrl
  const accountId   = cwData.chatwootAccountId
  const apiToken    = decryptToken(cwAccount.accessTokenEnc)

  if (!chatwootUrl || !accountId || !apiToken) {
    return NextResponse.json({ inboxCreated: false, reason: 'chatwoot_data_incomplete' })
  }

  const EVO_KEY = process.env.EVOLUTION_API_KEY
  if (!EVO_KEY) {
    return NextResponse.json({ inboxCreated: false, reason: 'evolution_key_not_configured' })
  }

  // URL interna Docker (evita hairpin NAT) — cai na pública se não definida
  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const cwBaseUrl   = internalUrl ?? chatwootUrl.replace(/\/$/, '')

  const inboxName = `WhatsApp - ${instanceName}`

  // ── 3. Chama Evolution API — cria inbox no Chatwoot automaticamente ─────────
  try {
    const evoRes = await fetch(`${serverUrl}/chatwoot/set/${instanceName}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({
        enabled:                 true,
        accountId:               String(accountId),
        token:                   apiToken,
        url:                     chatwootUrl,
        signMsg:                 false,
        reopenConversation:      true,
        conversationPending:     false,
        nameInbox:               inboxName,
        mergeBrazilContacts:     true,
        importContacts:          false,
        importMessages:          false,
        daysLimitImportMessages: 0,
        autoCreate:              true,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!evoRes.ok) {
      const errText = await evoRes.text()
      console.error('[create-inbox] Evolution API error:', evoRes.status, errText)
      return NextResponse.json({ inboxCreated: false, reason: 'evolution_api_error' })
    }

    const evoJson = await evoRes.json() as EvoSetChatwootResponse
    const resolvedInboxName = evoJson?.chatwoot?.nameInbox ?? inboxName

    // ── 4. Busca o inboxId real no Chatwoot pelo nome ──────────────────────────
    // A Evolution não retorna o inboxId diretamente — precisamos buscá-lo
    let chatwootInboxId: number | undefined

    try {
      const cwRes = await fetch(
        `${cwBaseUrl}/api/v1/accounts/${accountId}/inboxes`,
        {
          headers: { api_access_token: apiToken },
          signal:  AbortSignal.timeout(8_000),
        }
      )

      if (cwRes.ok) {
        const cwJson = await cwRes.json() as CwInboxListResponse
        const found  = cwJson.payload?.find(
          (inbox) => inbox.name === resolvedInboxName || inbox.name === inboxName
        )
        chatwootInboxId = found?.id
      }
    } catch {
      // Silencioso — inbox foi criado, só não conseguimos o id agora
      console.warn('[create-inbox] Não foi possível buscar inboxId no Chatwoot')
    }

    // ── 5. Persiste chatwootInboxId no data do ConnectedAccount(whatsapp) ──────
    const updatedData: EvoData = {
      ...waData,
      chatwootInboxId,
    }

    await prisma.connectedAccount.update({
      where: { provider_organizationId: { provider: 'whatsapp', organizationId } },
      data:  {
        lastSyncAt: new Date(),
        lastError:  null,
        data:       JSON.stringify(updatedData),
      },
    })

    return NextResponse.json({
      inboxCreated: true,
      inboxName:    resolvedInboxName,
      inboxId:      chatwootInboxId,
    })

  } catch (err) {
    console.error('[create-inbox] Unexpected error:', err)
    return NextResponse.json({ inboxCreated: false, reason: 'unexpected_error' })
  }
}
