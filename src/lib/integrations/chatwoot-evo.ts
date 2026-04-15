// src/lib/integrations/chatwoot-evo.ts
/**
 * Helper: integração Evolution API ↔ Chatwoot
 *
 * Estratégia segura:
 * - seguir a lógica oficial da Evolution para /chatwoot/set/{instance}
 * - deixar a Evolution criar/amarra a inbox no Chatwoot (autoCreate: true)
 * - depois localizar a inbox criada no Chatwoot e persistir o inboxId
 *
 * REGRA:
 * - usar /api/v1/ no Chatwoot
 * - token Chatwoot sempre vem do banco
 * - URL pública do Chatwoot vai para a Evolution
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

function buildChatwootInboxName(orgSlug: string, instanceName: string): string {
  const suffix = instanceName.split('-').pop()?.slice(-10) ?? instanceName.slice(-10)
  return `WhatsApp - ${orgSlug} - ${suffix}`.slice(0, 120)
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

  if (exact) return exact.id

  return null
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
    retries = 5,
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
}): Promise<EvoWebhookResult> {
  const { evoUrl, evoKey, instanceName, organizationId, orgSlug } = params

  const creds = await getChatwootCreds(organizationId)

  if (!creds) {
    return { success: false, error: 'Credenciais Chatwoot não encontradas' }
  }

  const inboxName = buildChatwootInboxName(orgSlug, instanceName)

  const payload = {
    enabled: true,
    accountId: String(creds.accountId),
    token: creds.apiToken,
    url: creds.publicUrl.replace(/\/$/, ''),
    signMsg: true,
    reopenConversation: true,
    conversationPending: false,
    nameInbox: inboxName,
    mergeBrazilContacts: true,
    importContacts: true,
    importMessages: true,
    daysLimitImportMessages: 2,
    signDelimiter: '\n',
    autoCreate: true,
    organization: 'MDS CRM',
    logo: `${creds.publicUrl.replace(/\/$/, '')}/favicon.ico`,
    ignoreJids: [],
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
      `[ChatwootEvo] /chatwoot/set OK para instância ${instanceName} | inbox=${inboxName}`
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

  const inboxName = buildChatwootInboxName(orgSlug, instanceName)

  // 1. Primeiro tenta achar inbox já existente
  let inboxId = await findExistingInbox(
    creds.baseUrl,
    creds.accountId,
    creds.apiToken,
    inboxName
  )

  // 2. Configura integração oficial da Evolution
  const webhookResult = await setEvolutionWebhook({
    evoUrl,
    evoKey,
    instanceName,
    organizationId,
    orgSlug,
  })

  if (!webhookResult.success) {
    return {
      success: false,
      chatwootInboxId: inboxId,
      skipped: false,
    }
  }

  // 3. Se a inbox ainda não existia, espera e busca novamente
  if (!inboxId) {
    inboxId = await findInboxWithRetries({
      baseUrl: creds.baseUrl,
      accountId: creds.accountId,
      apiToken: creds.apiToken,
      inboxName,
      retries: 6,
      delayMs: 1500,
    })
  }

  if (!inboxId) {
    console.warn(
      `[ChatwootEvo] Integração configurada, mas inbox ainda não apareceu no Chatwoot: ${inboxName}`
    )
  } else {
    console.log(
      `[ChatwootEvo] Inbox confirmada no Chatwoot: ${inboxName} (id=${inboxId})`
    )
  }

  return {
    success: true,
    chatwootInboxId: inboxId ?? null,
    skipped: false,
  }
}