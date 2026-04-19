/**
 * src/lib/integrations/evolutionClient.ts
 *
 * ─── Cliente centralizado da Evolution API ────────────────────────────────────
 * REGRA DE MANUTENÇÃO:
 * - TODAS as chamadas à Evolution API passam por este arquivo.
 * - Nunca chame a Evolution diretamente nos route handlers.
 * - Garante resiliência a updates da API (muda aqui, reflete em todo o projeto).
 */

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
  return { EVO_URL: url.replace(/\/$/, ''), EVO_KEY: key }
}

const DEFAULT_TIMEOUT = 10_000

async function evoFetch<T = unknown>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const { EVO_URL, EVO_KEY } = getConfig()
  const { timeoutMs = DEFAULT_TIMEOUT, ...fetchOptions } = options

  const url = `${EVO_URL}${path}`

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers: {
        apikey: EVO_KEY,
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...fetchOptions.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, data: null, error: `${res.status}: ${text}` }
    }

    if (res.status === 204) {
      return { ok: true, status: 204, data: null }
    }

    const data = (await res.json()) as T
    return { ok: true, status: res.status, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[EvoClient] Erro em ${path}:`, msg)
    return { ok: false, status: 0, data: null, error: msg }
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EvolutionConnectionState =
  | 'open'
  | 'close'
  | 'connecting'
  | 'not_found'
  | 'unknown'

export interface EvoInstanceState {
  state: 'open' | 'close' | 'connecting' | string
}

export interface EvoInstanceInfo {
  instance?: {
    instanceName?: string
    profileName?: string
    wuid?: string
    state?: string
  }
}

export interface EvoQRCodeResponse {
  base64?: string
  code?: string
  count?: number
  connected?: boolean
  pending?: boolean
  state?: EvolutionConnectionState
}

// ─── Instance ─────────────────────────────────────────────────────────────────

/**
 * Verifica o estado de conexão de uma instância.
 * - 404 => not_found
 * - erro transitório => unknown
 */
export async function getInstanceState(
  instanceName: string
): Promise<EvolutionConnectionState> {
  const res = await evoFetch<{ instance?: EvoInstanceState }>(
    `/instance/connectionState/${instanceName}`
  )

  if (res.status === 404) return 'not_found'
  if (!res.ok) return 'unknown'

  return (res.data?.instance?.state as 'open' | 'close' | 'connecting') ?? 'unknown'
}

/**
 * Busca informações de uma instância (incluindo número wuid).
 */
export async function fetchInstanceInfo(
  instanceName: string
): Promise<EvoInstanceInfo | null> {
  const res = await evoFetch<EvoInstanceInfo[]>(
    `/instance/fetchInstances?instanceName=${instanceName}`
  )
  if (!res.ok || !res.data) return null
  return res.data[0] ?? null
}

/**
 * Cria uma instância WhatsApp Baileys.
 */
export async function createInstance(instanceName: string): Promise<boolean> {
  const res = await evoFetch(`/instance/create`, {
    method: 'POST',
    body: JSON.stringify({
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    }),
    timeoutMs: 15_000,
  })
  return res.ok
}

/**
 * Faz logout de uma instância (mantém a instância, apenas desconecta).
 */
export async function logoutInstance(instanceName: string): Promise<boolean> {
  const res = await evoFetch(`/instance/logout/${instanceName}`, {
    method: 'DELETE',
    timeoutMs: 12_000,
  })

  return res.ok || res.status === 404
}

/**
 * Deleta uma instância completamente.
 */
export async function deleteInstance(instanceName: string): Promise<boolean> {
  const res = await evoFetch(`/instance/delete/${instanceName}`, {
    method: 'DELETE',
    timeoutMs: 12_000,
  })

  return res.ok || res.status === 404
}

/**
 * Reinicia uma instância (tenta reconectar sem deletar).
 */
export async function restartInstance(instanceName: string): Promise<boolean> {
  const res = await evoFetch(`/instance/restart/${instanceName}`, {
    method: 'PUT',
  })
  return res.ok
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Busca o snapshot atual do QR Code sem loop agressivo.
 *
 * Regras:
 * - se já estiver open, retorna connected=true
 * - faz no máximo 1 chamada em /instance/connect por ciclo
 * - não embute retry aqui; retry pertence à UI/orquestração
 */
export async function getQRCode(
  instanceName: string
): Promise<EvoQRCodeResponse | null> {
  const initialState = await getInstanceState(instanceName)

  if (initialState === 'open') {
    return {
      connected: true,
      pending: false,
      state: 'open',
    }
  }

  if (initialState === 'not_found') {
    return null
  }

  const res = await evoFetch<EvoQRCodeResponse>(
    `/instance/connect/${instanceName}`,
    { timeoutMs: 10_000 }
  )

  if (!res.ok) {
    const fallbackState = await getInstanceState(instanceName)

    if (fallbackState === 'open') {
      return {
        connected: true,
        pending: false,
        state: 'open',
      }
    }

    return {
      connected: false,
      pending: true,
      state: fallbackState === 'not_found' ? 'connecting' : fallbackState,
    }
  }

  const data = res.data ?? {}

  if (data.connected) {
    return {
      ...data,
      connected: true,
      pending: false,
      state: 'open',
    }
  }

  if (data.base64 || data.code) {
    return {
      ...data,
      connected: false,
      pending: true,
      state: 'connecting',
    }
  }

  const finalState = await getInstanceState(instanceName)

  if (finalState === 'open') {
    return {
      connected: true,
      pending: false,
      state: 'open',
    }
  }

  return {
    connected: false,
    pending: true,
    state: finalState === 'not_found' ? 'connecting' : finalState,
  }
}

/**
 * Desconecta completamente uma instância:
 * logout → delete
 */
export async function disconnectInstance(instanceName: string): Promise<boolean> {
  const logoutOk = await logoutInstance(instanceName)
  const deleteOk = await deleteInstance(instanceName)

  return logoutOk && deleteOk
}

/**
 * Aguarda uma instância sair do estado operacional.
 * Considera OK quando:
 * - not_found
 * - close
 */
export async function waitUntilInstanceInactive(
  instanceName: string,
  attempts = 5,
  delayMs = 1200
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const state = await getInstanceState(instanceName)

    if (state === 'not_found' || state === 'close') {
      return true
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs)
    }
  }

  return false
}

// ─── Chatwoot Integration ─────────────────────────────────────────────────────

export interface EvoChatwootConfig {
  enabled: boolean
  accountId: number
  token: string
  url: string
  signMsg: boolean
  reopenConversation: boolean
  conversationPending: boolean
  mergeBrazilContacts: boolean
  importContacts: boolean
  importMessages: boolean
  daysLimitImportMessages: number
  autoCreate: boolean
  nameInbox: string
}

/**
 * Configura a integração Evolution → Chatwoot para uma instância.
 */
export async function setChatwootIntegration(
  instanceName: string,
  config: EvoChatwootConfig
): Promise<boolean> {
  const res = await evoFetch(`/chatwoot/set/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify(config),
  })

  if (!res.ok) {
    console.error(`[EvoClient] Falha ao configurar Chatwoot para ${instanceName}:`, res.error)
  }

  return res.ok
}