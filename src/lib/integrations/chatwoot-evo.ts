// src/lib/integrations/chatwoot-evo.ts
/**
 * Helper: integração Evolution API ↔ Chatwoot
 * - Cria/busca inbox WhatsApp no Chatwoot
 * - Configura webhook da Evolution apontando para o Chatwoot
 *
 * REGRA DE MANUTENÇÃO:
 * - Sempre usar /api/v1/ (nunca /api/latest/)
 * - Token do Chatwoot sempre vem do banco (decryptToken), nunca de env diretamente
 * - URL interna Docker (CHATWOOT_INTERNAL_URL) para chamadas server→server
 * - URL pública (chatwootUrl salvo no banco) para webhook da Evolution (chamada externa)
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildChatwootInboxName(orgSlug: string, instanceName: string): string {
  const suffix = instanceName.split('-').pop()?.slice(-10) ?? instanceName.slice(-10)
  return `WhatsApp - ${orgSlug} - ${suffix}`.slice(0, 120)
}

// ─── Busca credenciais Chatwoot da organização ────────────────────────────────

async function getChatwootCreds(organizationId: string): Promise<{
  baseUrl: string
  publicUrl: string
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
    const publicUrl = data.chatwootUrl.replace(/\/$/, '')

    const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
    const baseUrl = internalUrl ?? publicUrl

    return {
      baseUrl,
      publicUrl,
      accountId: data.chatwootAccountId,
      apiToken,
    }
  } catch {
    return null
  }
}

// ─── Busca inbox existente pelo nome ──────────────────────────────────────────

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

    const json = await res.json() as {
      payload?: Array<{ id: number; name: string }>
    }

    const inbox = json.payload?.find(
      (item) => item.name.toLowerCase() === inboxName.toLowerCase()
    )

    return inbox?.id ?? null
  } catch {
    return null
  }
}

// ─── Cria inbox WhatsApp no Chatwoot ──────────────────────────────────────────

async function createChatwootInbox(
  baseUrl: string,
  accountId: number,
  apiToken: string,
  inboxName: string,
  _phoneNumber: string | null,
  instanceName: string,
  evoUrl: string
): Promise<number | null> {
  try {
    const webhookUrl = `${evoUrl}/chatwoot/webhook/${instanceName}`

    const body: Record<string, unknown> = {
      name: inboxName,
      channel: {
        type: 'api',
        webhook_url: webhookUrl,
      },
    }

    console.log(`[ChatwootEvo] Criando inbox "${inboxName}" com webhook: ${webhookUrl}`)

    const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/inboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: apiToken,
      },
      body: JSON.stringify(body),
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

// ─── Garante inbox (busca ou cria) ────────────────────────────────────────────

export async function ensureChatwootInbox(
  organizationId: string,
  orgSlug: string,
  phoneNumber: string | null,
  instanceName: string,
  evoUrl: string
): Promise<ChatwootInboxResult | null> {
  const creds = await getChatwootCreds(organizationId)

  if (!creds) {
    console.log('[ChatwootEvo] Chatwoot não configurado para org:', orgSlug)
    return null
  }

  const inboxName = buildChatwootInboxName(orgSlug, instanceName)

  const existingId = await findExistingInbox(
    creds.baseUrl,
    creds.accountId,
    creds.apiToken,
    inboxName
  )

  if (existingId) {
    console.log(
      `[ChatwootEvo] Inbox existente encontrado: ${inboxName} (id=${existingId})`
    )
    return { inboxId: existingId, inboxName }
  }

  const newId = await createChatwootInbox(
    creds.baseUrl,
    creds.accountId,
    creds.apiToken,
    inboxName,
    phoneNumber,
    instanceName,
    evoUrl
  )

  if (!newId) {
    console.error('[ChatwootEvo] Falha ao criar inbox no Chatwoot')
    return null
  }

  console.log(`[ChatwootEvo] Inbox criado: ${inboxName} (id=${newId})`)
  return { inboxId: newId, inboxName }
}

// ─── Configura webhook Evolution → Chatwoot ───────────────────────────────────

export async function setEvolutionWebhook(
  evoUrl: string,
  evoKey: string,
  instanceName: string,
  chatwootAccountId: number,
  chatwootInboxId: number,
  _unusedInboxId?: number,
  organizationId?: string,
  orgSlug?: string
): Promise<EvoWebhookResult> {
  let publicUrl: string | undefined
  let apiToken: string | undefined

  if (organizationId) {
    const creds = await getChatwootCreds(organizationId)
    if (creds) {
      publicUrl = creds.publicUrl
      apiToken = creds.apiToken
    }
  }

  if (!publicUrl) {
    publicUrl = process.env.CHATWOOT_API_URL
      ?.replace(/\/api\/v1$/, '')
      .replace(/\/$/, '')
  }

  if (!publicUrl) {
    return { success: false, error: 'URL pública do Chatwoot não disponível' }
  }

  if (!apiToken) {
    apiToken = process.env.CHATWOOT_API_KEY ?? ''
    if (!apiToken) {
      return { success: false, error: 'Token Chatwoot não disponível' }
    }

    console.warn(
      '[ChatwootEvo] Usando CHATWOOT_API_KEY do env como fallback — prefira passar organizationId'
    )
  }

  const resolvedOrgSlug =
    orgSlug ??
    instanceName.replace(/^org-/, '').split('-').slice(0, -1).join('-') ??
    'org'

  const inboxName = buildChatwootInboxName(resolvedOrgSlug, instanceName)

  const payload = {
    enabled: true,
    accountId: chatwootAccountId,
    token: apiToken,
    url: publicUrl,
    signMsg: false,
    reopenConversation: true,
    conversationPending: false,
    mergeBrazilContacts: true,
    importContacts: true,
    importMessages: false,
    daysLimitImportMessages: 0,
    autoCreate: false,
    nameInbox: inboxName,
  }

  try {
    const res = await fetch(`${evoUrl}/chatwoot/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evoKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(
        '[ChatwootEvo] Erro ao configurar webhook Evolution:',
        res.status,
        errText
      )
      return {
        success: false,
        error: `Evolution retornou ${res.status}: ${errText}`,
      }
    }

    console.log(
      `[ChatwootEvo] Webhook Evolution→Chatwoot configurado para instância: ${instanceName}`
    )
    console.log(
      `[ChatwootEvo] Inbox individual vinculada: ${inboxName} | inboxId=${chatwootInboxId}`
    )

    return { success: true }
  } catch (err) {
    console.error('[ChatwootEvo] Exceção ao configurar webhook Evolution:', err)
    return { success: false, error: String(err) }
  }
}

// ─── Orquestrador principal ────────────────────────────────────────────────────

export async function setupChatwootEvolution(params: {
  organizationId: string
  orgSlug: string
  instanceName: string
  evoUrl: string
  evoKey: string
  phoneNumber: string | null
}): Promise<{
  success: boolean
  chatwootInboxId: number | null
  skipped: boolean
}> {
  const { organizationId, orgSlug, instanceName, evoUrl, evoKey, phoneNumber } = params

  const inboxResult = await ensureChatwootInbox(
    organizationId,
    orgSlug,
    phoneNumber,
    instanceName,
    evoUrl
  )

  if (!inboxResult) {
    return { success: true, chatwootInboxId: null, skipped: true }
  }

  const creds = await getChatwootCreds(organizationId)

  if (!creds) {
    console.error('[ChatwootEvo] Credenciais Chatwoot não encontradas após criar inbox')
    return {
      success: false,
      chatwootInboxId: inboxResult.inboxId,
      skipped: false,
    }
  }

  const webhookResult = await setEvolutionWebhook(
    evoUrl,
    evoKey,
    instanceName,
    creds.accountId,
    inboxResult.inboxId,
    undefined,
    organizationId,
    orgSlug
  )

  if (!webhookResult.success) {
    console.warn(
      '[ChatwootEvo] Webhook não configurado, mas inbox foi criado. InboxId:',
      inboxResult.inboxId,
      '| Erro:',
      webhookResult.error
    )
    return {
      success: false,
      chatwootInboxId: inboxResult.inboxId,
      skipped: false,
    }
  }

  return {
    success: true,
    chatwootInboxId: inboxResult.inboxId,
    skipped: false,
  }
}