// app/api/integrations/whatsapp/create-inbox/route.ts
import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

interface EvoData {
  serverUrl:    string
  instanceName: string
  chatwootInboxId?: number
}

interface CwData {
  chatwootUrl:       string
  chatwootAccountId: number
}

interface EvoSetChatwootResponse {
  chatwoot?: {
    accountId?:  number
    nameInbox?:  string
    webhookUrl?: string
    enabled?:    boolean
  }
}

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  // ── 1. Busca ConnectedAccount do WhatsApp ──────────────────────────────────
  const waAccount = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'whatsapp', organizationId },
    },
    select: { data: true, isActive: true },
  })

  if (!waAccount?.isActive) {
    return NextResponse.json(
      { inboxCreated: false, reason: 'whatsapp_not_connected' },
      { status: 200 }
    )
  }

  const waData = JSON.parse(waAccount.data) as EvoData
  const { serverUrl, instanceName } = waData

  if (!serverUrl || !instanceName) {
    return NextResponse.json(
      { inboxCreated: false, reason: 'whatsapp_data_incomplete' },
      { status: 200 }
    )
  }

  // ── 2. Busca ConnectedAccount do Chatwoot ──────────────────────────────────
  const cwAccount = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId },
    },
    select: { data: true, accessTokenEnc: true, isActive: true },
  })

  if (!cwAccount?.isActive) {
    return NextResponse.json(
      { inboxCreated: false, reason: 'chatwoot_not_configured' },
      { status: 200 }
    )
  }

  const cwData       = JSON.parse(cwAccount.data) as CwData
  const chatwootUrl  = cwData.chatwootUrl
  const accountId    = cwData.chatwootAccountId
  const apiToken     = decryptToken(cwAccount.accessTokenEnc)

  if (!chatwootUrl || !accountId || !apiToken) {
    return NextResponse.json(
      { inboxCreated: false, reason: 'chatwoot_data_incomplete' },
      { status: 200 }
    )
  }

  // ── 3. Busca EVOLUTION_API_KEY do env ──────────────────────────────────────
  const EVO_KEY = process.env.EVOLUTION_API_KEY
  if (!EVO_KEY) {
    return NextResponse.json(
      { inboxCreated: false, reason: 'evolution_key_not_configured' },
      { status: 200 }
    )
  }

  // ── 4. Chama Evolution API — POST /chatwoot/set/{instanceName} ─────────────
  // A Evolution cria o inbox no Chatwoot E configura o webhook automaticamente
  try {
    const evoRes = await fetch(
      `${serverUrl}/chatwoot/set/${instanceName}`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey:          EVO_KEY,
        },
        body: JSON.stringify({
          enabled:              true,
          accountId:            String(accountId),
          token:                apiToken,
          url:                  chatwootUrl,
          signMsg:              false,
          reopenConversation:   true,
          conversationPending:  false,
          nameInbox:            `WhatsApp - ${instanceName}`,
          mergeBrazilContacts:  true,
          importContacts:       false,
          importMessages:       false,
          daysLimitImportMessages: 0,
          autoCreate:           true,
        }),
        signal: AbortSignal.timeout(15_000),
      }
    )

    if (!evoRes.ok) {
      const errText = await evoRes.text()
      console.error('[create-inbox] Evolution API error:', evoRes.status, errText)
      return NextResponse.json(
        { inboxCreated: false, reason: 'evolution_api_error', detail: evoRes.status },
        { status: 200 }
      )
    }

    const evoJson = await evoRes.json() as EvoSetChatwootResponse

    // ── 5. Persiste inboxId no data do ConnectedAccount(whatsapp) ─────────────
    // O campo data é JSON livre — sem necessidade de migration
    const updatedData: EvoData = {
      ...waData,
      chatwootInboxId: evoJson?.chatwoot?.accountId ?? undefined,
    }

    await prisma.connectedAccount.update({
      where: {
        provider_organizationId: { provider: 'whatsapp', organizationId },
      },
      data: {
        lastSyncAt: new Date(),
        lastError:  null,
        data:       JSON.stringify(updatedData),
      },
    })

    return NextResponse.json({
      inboxCreated: true,
      inboxName:    evoJson?.chatwoot?.nameInbox ?? `WhatsApp - ${instanceName}`,
      accountId,
    })

  } catch (err) {
    console.error('[create-inbox] Unexpected error:', err)
    return NextResponse.json(
      { inboxCreated: false, reason: 'unexpected_error' },
      { status: 200 }
    )
  }
}
