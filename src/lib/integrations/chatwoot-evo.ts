// src/lib/integrations/chatwoot-evo.ts
/**
 * Helper: integração Evolution API ↔ Chatwoot
 *
 * Regra:
 * - instanceName = nome técnico estável
 * - inboxName/label = nome amigável visível no Chatwoot e no CRM
 * - seguir /chatwoot/set/{instance} da Evolution
 */

import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

interface EvoWebhookResult {
  success: boolean
  error?: string
}

type ChatwootCreds = {
  baseUrl: string
  publicUrl: string
  accountId: number
  apiToken: string
}

function buildDefaultChatwootInboxName(orgSlug: string, instanceName: string): string {
  const suffix = instanceName.split('-').pop()?.slice(-8) ?? instanceName.slice(-8)
  return `WA - ${orgSlug} - ${suffix}`.slice(0, 120)
}

function sanitizeInboxName(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== 'string') return fallback
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return fallback
  return normalized.slice(0, 120)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function listChatwootInboxes(
  baseUrl: string,
  accountId: number,
  apiToken: string
): Promise<Array<{ id: number; name: string }> | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/inboxes`, {
      headers: { api_access_token: apiToken },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return null

    const json = await res.json() as {
      payload?: Array<{ id: number; name: string }>
    }

    return json.payload ?? []
  } catch {
    return null
  }
}

async function getChatwootCreds(organizationId: string): Promise<ChatwootCreds | null> {
  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId },
    },
    select: {
      accessTokenEnc: true,
      isActive: true,
      data: true,
    },
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

async function findExistingInbox(
  baseUrl: string,
  accountId: number,
  apiToken: string,
  inboxName: string
): Promise<number | null> {
  const inboxes = await listChatwootInboxes(baseUrl, accountId, apiToken)
  if (!inboxes) return null

  const normalizedTarget = inboxName.toLowerCase().trim()

  const exact = inboxes.find(
    (item) => item.name.toLowerCase().trim() === normalizedTarget
  )

  return exact?.id ?? null
}

async function findInboxWithRetries(params: {
  baseUrl: string
  accountId: number
  apiToken: string
  inboxName: string
  retries?: number
  delayMs?: number
}): Promise<number | null> {
  const {
    baseUrl,
    accountId,
    apiToken,
    inboxName,
    retries = 6,
    delayMs = 1500,
  } = params

  for (let attempt = 0; attempt < retries; attempt++) {
    const inboxId = await findExistingInbox(baseUrl, accountId, apiToken, inboxName)
    if (inboxId) return inboxId

    if (attempt < retries - 1) {
      await sleep(delayMs)
    }
  }

  return null
}

export async function doesChatwootInboxExist(
  organizationId: string,
  inboxId: number
): Promise<boolean | null> {
  const creds = await getChatwootCreds(organizationId)
  if (!creds) return null

  const inboxes = await listChatwootInboxes(
    creds.baseUrl,
    creds.accountId,
    creds.apiToken
  )

  if (!inboxes) return null

  return inboxes.some((item) => item.id === inboxId)
}

export async function setEvolutionWebhook(params: {
  evoUrl: string
  evoKey: string
  instanceName: string
  organizationId: string
  orgSlug: string
  inboxName?: string | null
}): Promise<EvoWebhookResult> {
  const { evoUrl, evoKey, instanceName, organizationId, orgSlug, inboxName } = params

  const creds = await getChatwootCreds(organizationId)

  if (!creds) {
    return { success: false, error: 'Credenciais Chatwoot não encontradas' }
  }

  const resolvedInboxName = sanitizeInboxName(
    inboxName,
    buildDefaultChatwootInboxName(orgSlug, instanceName)
  )

  const payload = {
    enabled: true,
    accountId: String(creds.accountId),
    token: creds.apiToken,
    url: creds.publicUrl.replace(/\/$/, ''),
    signMsg: true,
    reopenConversation: true,
    conversationPending: false,
    mergeBrazilContacts: true,
    importContacts: true,
    importMessages: true,
    daysLimitImportMessages: 2,
    autoCreate: true,
    nameInbox: resolvedInboxName,
  }

  try {
    const res = await fetch(`${evoUrl.replace(/\/$/, '')}/chatwoot/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evoKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(
        '[ChatwootEvo] Erro ao configurar Evolution→Chatwoot:',
        res.status,
        errText
      )

      return {
        success: false,
        error: `Evolution retornou ${res.status}: ${errText}`,
      }
    }

    console.log(
      `[ChatwootEvo] /chatwoot/set OK para ${instanceName} | inbox=${resolvedInboxName}`
    )

    return { success: true }
  } catch (err) {
    console.error('[ChatwootEvo] Exceção ao configurar Evolution→Chatwoot:', err)
    return { success: false, error: String(err) }
  }
}

export async function setupChatwootEvolution(params: {
  organizationId: string
  orgSlug: string
  instanceName: string
  evoUrl: string
  evoKey: string
  phoneNumber: string | null
  inboxName?: string | null
}): Promise<{
  success: boolean
  chatwootInboxId: number | null
  skipped: boolean
}> {
  const {
    organizationId,
    orgSlug,
    instanceName,
    evoUrl,
    evoKey,
    inboxName,
  } = params

  const creds = await getChatwootCreds(organizationId)

  if (!creds) {
    console.log('[ChatwootEvo] Chatwoot não configurado para a organização')
    return {
      success: true,
      chatwootInboxId: null,
      skipped: true,
    }
  }

  const resolvedInboxName = sanitizeInboxName(
    inboxName,
    buildDefaultChatwootInboxName(orgSlug, instanceName)
  )

  let inboxId = await findExistingInbox(
    creds.baseUrl,
    creds.accountId,
    creds.apiToken,
    resolvedInboxName
  )

  const webhookResult = await setEvolutionWebhook({
    evoUrl,
    evoKey,
    instanceName,
    organizationId,
    orgSlug,
    inboxName: resolvedInboxName,
  })

  if (!webhookResult.success) {
    return {
      success: false,
      chatwootInboxId: inboxId,
      skipped: false,
    }
  }

  if (!inboxId) {
    inboxId = await findInboxWithRetries({
      baseUrl: creds.baseUrl,
      accountId: creds.accountId,
      apiToken: creds.apiToken,
      inboxName: resolvedInboxName,
      retries: 6,
      delayMs: 1500,
    })
  }

  if (!inboxId) {
    console.warn(
      `[ChatwootEvo] Integração configurada, mas inbox ainda não apareceu no Chatwoot: ${resolvedInboxName}`
    )
  } else {
    console.log(
      `[ChatwootEvo] Inbox confirmada no Chatwoot: ${resolvedInboxName} (id=${inboxId})`
    )
  }

  return {
    success: true,
    chatwootInboxId: inboxId ?? null,
    skipped: false,
  }
}