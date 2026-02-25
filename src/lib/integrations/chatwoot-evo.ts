// src/lib/integrations/chatwoot-evo.ts
/**
 * Helper: integração Evolution API ↔ Chatwoot
 * - Cria/busca inbox WhatsApp no Chatwoot
 * - Configura webhook da Evolution apontando para o Chatwoot
 */

import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

interface ChatwootInboxResult {
  inboxId: number
  inboxName: string
}

interface EvoWebhookResult {
  success: boolean
  error?: string
}

// ─── Busca credenciais Chatwoot da organização ────────────────────────────────

async function getChatwootCreds(organizationId: string): Promise<{
  baseUrl: string
  accountId: number
  apiToken: string
} | null> {
  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId },
    },
    select: { accessTokenEnc: true, isActive: true, data: true },
  })

  if (!account?.isActive) return null

  try {
    const data = JSON.parse(account.data) as {
      chatwootUrl: string
      chatwootAccountId: number
    }
    const apiToken = decryptToken(account.accessTokenEnc)
    // Prefere URL interna (evita hairpin NAT em Docker)
    const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
    const baseUrl = internalUrl ?? data.chatwootUrl.replace(/\/$/, '')
    return { baseUrl, accountId: data.chatwootAccountId, apiToken }
  } catch {
    return null
  }
}

// ─── Busca inbox existente pelo nome ─────────────────────────────────────────

async function findExistingInbox(
  baseUrl: string,
  accountId: number,
  apiToken: string,
  inboxName: string
): Promise<number | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/inboxes`, {
      headers: { api_access_token: apiToken },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null

    const json = await res.json() as { payload?: Array<{ id: number; name: string }> }
    const inbox = json.payload?.find(
      (i) => i.name.toLowerCase() === inboxName.toLowerCase()
    )
    return inbox?.id ?? null
  } catch {
    return null
  }
}

// ─── Cria inbox WhatsApp no Chatwoot ─────────────────────────────────────────

async function createChatwootInbox(
  baseUrl: string,
  accountId: number,
  apiToken: string,
  inboxName: string,
  phoneNumber: string | null
): Promise<number | null> {
  try {
    const body: Record<string, unknown> = {
      name:         inboxName,
      channel: {
        type:         'whatsapp',
        phone_number: phoneNumber ?? '',
        provider:     'whatsapp_cloud_api', // Evolution usa esse provider
      },
    }

    const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/inboxes`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        api_access_token:  apiToken,
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[ChatwootEvo] Erro ao criar inbox:', res.status, errText)
      return null
    }

    const json = await res.json() as { id?: number }
    return json.id ?? null
  } catch (err) {
    console.error('[ChatwootEvo] Exceção ao criar inbox:', err)
    return null
  }
}

// ─── Garante inbox (busca ou cria) ───────────────────────────────────────────

export async function ensureChatwootInbox(
  organizationId: string,
  orgSlug: string,
  phoneNumber: string | null
): Promise<ChatwootInboxResult | null> {
  const creds = await getChatwootCreds(organizationId)
  if (!creds) {
    console.log('[ChatwootEvo] Chatwoot não configurado para org:', orgSlug)
    return null
  }

  const inboxName = `WhatsApp - ${orgSlug}`

  // 1. Tenta encontrar inbox já existente
  const existingId = await findExistingInbox(
    creds.baseUrl,
    creds.accountId,
    creds.apiToken,
    inboxName
  )

  if (existingId) {
    console.log(`[ChatwootEvo] Inbox existente encontrado: ${inboxName} (id=${existingId})`)
    return { inboxId: existingId, inboxName }
  }

  // 2. Cria novo inbox
  const newId = await createChatwootInbox(
    creds.baseUrl,
    creds.accountId,
    creds.apiToken,
    inboxName,
    phoneNumber
  )

  if (!newId) {
    console.error('[ChatwootEvo] Falha ao criar inbox no Chatwoot')
    return null
  }

  console.log(`[ChatwootEvo] Inbox criado: ${inboxName} (id=${newId})`)
  return { inboxId: newId, inboxName }
}

// ─── Configura webhook Evolution → Chatwoot ──────────────────────────────────

export async function setEvolutionWebhook(
  evoUrl: string,
  evoKey: string,
  instanceName: string,
  chatwootAccountId: number,
  chatwootInboxId: number
): Promise<EvoWebhookResult> {
  // URL pública do Chatwoot (sempre a pública — Evolution chama de fora)
  const chatwootPublicUrl = process.env.CHATWOOT_API_URL
    ?.replace(/\/api\/v1$/, '')
    .replace(/\/$/, '')

  if (!chatwootPublicUrl) {
    return { success: false, error: 'CHATWOOT_API_URL não configurada' }
  }

  // Endpoint nativo Evolution v2 para integrar com Chatwoot
  const payload = {
    enabled:        true,
    accountId:      chatwootAccountId,
    token:          process.env.CHATWOOT_API_KEY ?? '',
    url:            chatwootPublicUrl,
    signMsg:        false,
    reopenConversation: true,
    conversationPending: false,
    mergeBrazilContacts: true,
    importContacts:      true,
    importMessages:      false,
    daysLimitImportMessages: 0,
    autoCreate: true,
    nameInbox:  `WhatsApp - ${instanceName}`,
  }

  try {
    const res = await fetch(
      `${evoUrl}/chatwoot/set/${instanceName}`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey:         evoKey,
        },
        body:   JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[ChatwootEvo] Erro ao configurar webhook Evolution:', res.status, errText)
      return { success: false, error: `Evolution retornou ${res.status}` }
    }

    console.log(`[ChatwootEvo] Webhook Evolution→Chatwoot configurado para instância: ${instanceName}`)
    return { success: true }
  } catch (err) {
    console.error('[ChatwootEvo] Exceção ao configurar webhook Evolution:', err)
    return { success: false, error: String(err) }
  }
}

// ─── Orquestrador principal ───────────────────────────────────────────────────

export async function setupChatwootEvolution(params: {
  organizationId: string
  orgSlug:        string
  instanceName:   string
  evoUrl:         string
  evoKey:         string
  phoneNumber:    string | null
}): Promise<{
  success:        boolean
  chatwootInboxId: number | null
  skipped:        boolean   // true = Chatwoot não configurado (sem erro)
}> {
  const { organizationId, orgSlug, instanceName, evoUrl, evoKey, phoneNumber } = params

  // 1. Garante inbox no Chatwoot
  const inboxResult = await ensureChatwootInbox(organizationId, orgSlug, phoneNumber)

  if (!inboxResult) {
    // Chatwoot não configurado — não é erro, apenas pula
    return { success: true, chatwootInboxId: null, skipped: true }
  }

  // 2. Busca chatwootAccountId para configurar webhook
  const cwAccount = await prisma.connectedAccount.findUnique({
    where: { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { data: true },
  })

  const cwData = cwAccount
    ? (JSON.parse(cwAccount.data) as { chatwootAccountId: number })
    : null

  if (!cwData?.chatwootAccountId) {
    return { success: false, chatwootInboxId: inboxResult.inboxId, skipped: false }
  }

  // 3. Configura webhook Evolution → Chatwoot
  const webhookResult = await setEvolutionWebhook(
    evoUrl,
    evoKey,
    instanceName,
    cwData.chatwootAccountId,
    inboxResult.inboxId
  )

  if (!webhookResult.success) {
    console.warn('[ChatwootEvo] Webhook não configurado, mas inbox foi criado. InboxId:', inboxResult.inboxId)
    // Retorna parcial — inbox criado mas webhook falhou
    // Não bloqueia o connect do WhatsApp
    return { success: false, chatwootInboxId: inboxResult.inboxId, skipped: false }
  }

  return { success: true, chatwootInboxId: inboxResult.inboxId, skipped: false }
}
