/**
 * src/lib/integrations/chatwootOnboarding.ts
 *
 * ─── Onboarding automático do Chatwoot por org nova ──────────────────────────
 *
 * CRÍTICO PARA O SAAS:
 * - Chamado no signup de nova organização
 * - Sem este módulo, cada novo cliente exige intervenção manual no banco
 *
 * O que faz:
 *  1. Cria um account no Chatwoot via API de superadmin
 *  2. Cria um agent user no Chatwoot para o owner da org
 *  3. Salva ConnectedAccount { provider: 'chatwoot' } no banco automaticamente
 *
 * Pré-requisitos no .env / Coolify:
 *  CHATWOOT_API_URL          = https://app.mundodigitalsolucoes.com.br
 *  CHATWOOT_INTERNAL_URL     = http://chatwoot:3000 (opcional, server-to-server)
 *  CHATWOOT_SUPER_ADMIN_TOKEN = token do superadmin (Perfil → Access Token no Chatwoot)
 */

import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

// ─── Config ───────────────────────────────────────────────────────────────────

function getChatwootAdminConfig(): {
  publicUrl:   string
  internalUrl: string
  adminToken:  string
} {
  const publicUrl  = process.env.CHATWOOT_API_URL?.replace(/\/$/, '')
  const adminToken = process.env.CHATWOOT_SUPER_ADMIN_TOKEN  // ← nome correto do Coolify

  if (!publicUrl)  throw new Error('CHATWOOT_API_URL não configurado.')
  if (!adminToken) throw new Error('CHATWOOT_SUPER_ADMIN_TOKEN não configurado.')

  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '') ?? publicUrl

  return { publicUrl, internalUrl, adminToken }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChatwootAccount {
  id:   number
  name: string
}

interface ChatwootAgent {
  id:            number
  name:          string
  email:         string
  access_token?: string
}

export interface ChatwootOnboardingResult {
  success:    boolean
  accountId?: number
  agentId?:   number
  error?:     string
  skipped?:   boolean  // true = já estava configurado ou env ausente
}

// ─── API Helper ───────────────────────────────────────────────────────────────

async function chatwootAdminFetch<T = unknown>(
  path:    string,
  options: { method?: string; body?: object; token: string; baseUrl: string }
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const { method = 'GET', body, token, baseUrl } = options
  const url = `${baseUrl}${path}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type':   'application/json',
        api_access_token: token,
      },
      body:   body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, data: null, error: `${res.status}: ${text}` }
    }

    if (res.status === 204) return { ok: true, status: 204, data: null }

    const data = await res.json() as T
    return { ok: true, status: res.status, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, data: null, error: msg }
  }
}

// ─── Funções internas ─────────────────────────────────────────────────────────

async function createChatwootAccount(
  internalUrl: string,
  adminToken:  string,
  name:        string
): Promise<ChatwootAccount | null> {
  const res = await chatwootAdminFetch<ChatwootAccount | { data?: ChatwootAccount }>(
    '/api/v1/accounts',
    { method: 'POST', body: { name }, token: adminToken, baseUrl: internalUrl }
  )

  if (!res.ok || !res.data) {
    console.error('[ChatwootOnboarding] Falha ao criar account:', res.error)
    return null
  }

  // Chatwoot pode retornar { data: { id, name } } ou direto { id, name }
  const payload = res.data as { data?: ChatwootAccount; id?: number; name?: string }
  if (payload.data?.id) return payload.data
  if (payload.id)       return payload as ChatwootAccount
  return null
}

async function createChatwootAgent(
  internalUrl: string,
  adminToken:  string,
  accountId:   number,
  name:        string,
  email:       string
): Promise<ChatwootAgent | null> {
  // Verifica se agente já existe
  const listRes = await chatwootAdminFetch<ChatwootAgent[]>(
    `/api/v1/accounts/${accountId}/agents`,
    { token: adminToken, baseUrl: internalUrl }
  )

  if (listRes.ok && Array.isArray(listRes.data)) {
    const existing = listRes.data.find((a) => a.email === email)
    if (existing) {
      console.log(`[ChatwootOnboarding] Agente ${email} já existe no account ${accountId}`)
      return existing
    }
  }

  const res = await chatwootAdminFetch<ChatwootAgent>(
    `/api/v1/accounts/${accountId}/agents`,
    {
      method:  'POST',
      body:    { name, email, role: 'administrator' },
      token:   adminToken,
      baseUrl: internalUrl,
    }
  )

  if (!res.ok || !res.data) {
    console.error('[ChatwootOnboarding] Falha ao criar agente:', res.error)
    return null
  }

  return res.data
}

// ─── Exportado principal ──────────────────────────────────────────────────────

/**
 * Provisiona Chatwoot para uma organização nova.
 * Chamado no fluxo de signup, APÓS criar a org e o user no banco.
 * NÃO bloqueia o signup — use sem await ou com .catch().
 */
export async function provisionChatwootForOrg(params: {
  organizationId: string
  orgName:        string
  ownerEmail:     string
  ownerName:      string
  connectedById:  string
}): Promise<ChatwootOnboardingResult> {
  const { organizationId, orgName, ownerEmail, ownerName, connectedById } = params

  // Verifica se já está configurado
  const existing = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { isActive: true },
  })
  if (existing?.isActive) {
    console.log(`[ChatwootOnboarding] Org ${organizationId} já tem Chatwoot — pulando.`)
    return { success: true, skipped: true }
  }

  let config: ReturnType<typeof getChatwootAdminConfig>
  try {
    config = getChatwootAdminConfig()
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.warn('[ChatwootOnboarding] Config ausente — provisionamento pulado:', error)
    return { success: false, error, skipped: true }
  }

  const { publicUrl, internalUrl, adminToken } = config

  console.log(`[ChatwootOnboarding] Provisionando Chatwoot para org: ${orgName}`)

  // 1. Cria account
  const account = await createChatwootAccount(internalUrl, adminToken, orgName)
  if (!account) {
    return { success: false, error: 'Falha ao criar account no Chatwoot' }
  }
  console.log(`[ChatwootOnboarding] Account criado: id=${account.id}`)

  // 2. Cria agente owner (falha aqui não aborta — owner pode fazer login depois)
  const agent = await createChatwootAgent(
    internalUrl, adminToken, account.id, ownerName, ownerEmail
  )
  if (!agent) {
    console.warn(`[ChatwootOnboarding] Agente não criado para ${ownerEmail} — continuando.`)
  } else {
    console.log(`[ChatwootOnboarding] Agente criado: id=${agent.id}`)
  }

  // 3. Token a salvar: prefere o token de agente (se disponível), senão o de admin
  const tokenToStore = agent?.access_token ?? adminToken

  // 4. Salva ConnectedAccount no banco
  const data = JSON.stringify({
    chatwootUrl:       publicUrl,
    chatwootAccountId: account.id,
    agentId:           agent?.id ?? null,
    provisionedAt:     new Date().toISOString(),
  })

  await prisma.connectedAccount.upsert({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    create: {
      provider:       'chatwoot',
      organizationId,
      connectedById,
      accessTokenEnc: encryptToken(tokenToStore),
      isActive:       true,
      data,
    },
    update: {
      accessTokenEnc: encryptToken(tokenToStore),
      isActive:       true,
      lastError:      null,
      lastSyncAt:     new Date(),
      data,
    },
  })

  console.log(`[ChatwootOnboarding] ✅ Chatwoot provisionado para "${orgName}" | accountId=${account.id}`)

  return { success: true, accountId: account.id, agentId: agent?.id }
}