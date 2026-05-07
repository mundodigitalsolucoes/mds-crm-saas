// src/lib/chatwoot.ts
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

type ChatwootAccountData = {
  chatwootUrl?: string
  chatwootAccountId?: number | string
  chatwootUserId?: number | string
  ownerEmail?: string
  ownerPasswordEnc?: string
}

export interface ChatwootCredentials {
  chatwootUrl: string
  accountId: number
  token: string
}

export interface ChatwootConnectionMeta {
  connected: boolean
  chatwootUrl?: string
  chatwootAccountId?: number
  lastSyncAt?: Date | null
  lastError?: string | null
}

export interface ChatwootApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  timeoutMs?: number
}

export interface ChatwootTeam {
  id: number
  name: string
  description?: string
  agents_count?: number
}

export interface ChatwootAgent {
  id: number
  name: string
  email: string
  role?: string
  availability_status?: string
}

export interface ChatwootInbox {
  id: number
  name: string
  channel_type?: string
}

function normalizeBaseUrl(url?: string | null): string | null {
  return url?.trim().replace(/\/$/, '') || null
}

function toPositiveInt(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
  return num
}

function parseAccountData(raw: string): ChatwootAccountData | null {
  try {
    const parsed = JSON.parse(raw) as ChatwootAccountData
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

async function readChatwootError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')

  if (!text) return `Erro na API do Chatwoot (${res.status})`

  try {
    const json = JSON.parse(text) as { message?: string; error?: string }
    return json.message?.trim() || json.error?.trim() || `Erro na API do Chatwoot (${res.status})`
  } catch {
    return text
  }
}

async function parseResponseBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return null as T

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }

  const text = await res.text()
  return (text ? text : null) as T
}

export function resolveChatwootBaseUrl(chatwootUrl: string): string {
  return (
    normalizeBaseUrl(process.env.CHATWOOT_INTERNAL_URL) ||
    normalizeBaseUrl(chatwootUrl) ||
    ''
  )
}

export async function getChatwootConnectionMeta(
  organizationId: string
): Promise<ChatwootConnectionMeta> {
  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: {
        provider: 'chatwoot',
        organizationId,
      },
    },
    select: {
      isActive: true,
      lastSyncAt: true,
      lastError: true,
      data: true,
    },
  })

  if (!account || !account.isActive) return { connected: false }

  const data = parseAccountData(account.data)
  const chatwootUrl = normalizeBaseUrl(data?.chatwootUrl)
  const chatwootAccountId = toPositiveInt(data?.chatwootAccountId)

  if (!chatwootUrl || !chatwootAccountId) {
    return {
      connected: false,
      lastSyncAt: account.lastSyncAt,
      lastError: account.lastError,
    }
  }

  return {
    connected: true,
    chatwootUrl,
    chatwootAccountId,
    lastSyncAt: account.lastSyncAt,
    lastError: account.lastError,
  }
}

export async function getChatwootCredentials(
  organizationId: string
): Promise<ChatwootCredentials | null> {
  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: {
        provider: 'chatwoot',
        organizationId,
      },
    },
    select: {
      accessTokenEnc: true,
      data: true,
      isActive: true,
    },
  })

  if (!account || !account.isActive) return null

  try {
    const token = decryptToken(account.accessTokenEnc)
    const data = parseAccountData(account.data)
    const chatwootUrl = normalizeBaseUrl(data?.chatwootUrl)
    const accountId = toPositiveInt(data?.chatwootAccountId)

    if (!chatwootUrl || !accountId || !token) return null

    return { chatwootUrl, accountId, token }
  } catch {
    return null
  }
}

export async function getChatwootCredentialsByAccountId(
  chatwootAccountId: number
): Promise<(ChatwootCredentials & { organizationId: string }) | null> {
  const accounts = await prisma.connectedAccount.findMany({
    where: { provider: 'chatwoot', isActive: true },
    select: {
      organizationId: true,
      accessTokenEnc: true,
      data: true,
    },
  })

  for (const account of accounts) {
    try {
      const data = parseAccountData(account.data)
      const accountId = toPositiveInt(data?.chatwootAccountId)
      const chatwootUrl = normalizeBaseUrl(data?.chatwootUrl)

      if (accountId !== chatwootAccountId || !chatwootUrl) continue

      const token = decryptToken(account.accessTokenEnc)
      if (!token) continue

      return {
        organizationId: account.organizationId,
        chatwootUrl,
        accountId,
        token,
      }
    } catch {
      continue
    }
  }

  return null
}

export async function validateChatwootCredentials(input: {
  chatwootUrl: string
  accountId: number
  token: string
}): Promise<boolean> {
  const baseUrl = resolveChatwootBaseUrl(input.chatwootUrl)
  if (!baseUrl) return false

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/accounts/${input.accountId}/conversations?page=1`,
      {
        headers: { api_access_token: input.token },
        signal: AbortSignal.timeout(8_000),
      }
    )

    return res.ok
  } catch {
    return false
  }
}

export async function chatwootApi<T = unknown>(
  credentials: ChatwootCredentials,
  path: string,
  options: ChatwootApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, timeoutMs = 8_000 } = options
  const baseUrl = resolveChatwootBaseUrl(credentials.chatwootUrl)
  const url = `${baseUrl}/api/v1/accounts/${credentials.accountId}${path}`

  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      api_access_token: credentials.token,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) throw new Error(await readChatwootError(res))

  return parseResponseBody<T>(res)
}

export async function listChatwootTeams(
  credentials: ChatwootCredentials
): Promise<ChatwootTeam[]> {
  return chatwootApi<ChatwootTeam[]>(credentials, '/teams')
}

export async function createChatwootTeam(
  credentials: ChatwootCredentials,
  input: { name: string; description?: string }
): Promise<ChatwootTeam> {
  return chatwootApi<ChatwootTeam>(credentials, '/teams', {
    method: 'POST',
    body: {
      name: input.name,
      description: input.description ?? '',
      allow_auto_assign: true,
    },
  })
}

export async function deleteChatwootTeam(
  credentials: ChatwootCredentials,
  teamId: number
): Promise<void> {
  await chatwootApi(credentials, `/teams/${teamId}`, {
    method: 'DELETE',
  })
}

export async function addChatwootTeamMembers(
  credentials: ChatwootCredentials,
  teamId: number,
  agentIds: number[]
): Promise<void> {
  await chatwootApi(credentials, `/teams/${teamId}/team_members`, {
    method: 'POST',
    body: { user_ids: agentIds },
  })
}

export async function removeChatwootTeamMember(
  credentials: ChatwootCredentials,
  teamId: number,
  agentId: number
): Promise<void> {
  await chatwootApi(credentials, `/teams/${teamId}/team_members/${agentId}`, {
    method: 'DELETE',
  })
}

export async function listChatwootAgents(
  credentials: ChatwootCredentials
): Promise<ChatwootAgent[]> {
  return chatwootApi<ChatwootAgent[]>(credentials, '/agents')
}

export async function listChatwootInboxes(
  credentials: ChatwootCredentials
): Promise<ChatwootInbox[]> {
  return chatwootApi<ChatwootInbox[]>(credentials, '/inboxes')
}

export async function addChatwootInboxMembers(
  credentials: ChatwootCredentials,
  inboxId: number,
  agentIds: number[]
): Promise<void> {
  await chatwootApi(credentials, '/inbox_members', {
    method: 'POST',
    body: {
      inbox_id: inboxId,
      user_ids: agentIds,
    },
  })
}

export function normalizeChatwootChannel(channel?: string | null): string {
  if (!channel) return 'unknown'

  const map: Record<string, string> = {
    'Channel::Whatsapp': 'whatsapp',
    'Channel::Email': 'email',
    'Channel::WebWidget': 'web_widget',
    'Channel::Instagram': 'instagram',
    'Channel::FacebookPage': 'facebook',
    'Channel::Telegram': 'telegram',
    'Channel::Api': 'api',
    'Channel::Sms': 'sms',
  }

  return map[channel] ?? channel.replace('Channel::', '').toLowerCase()
}

export function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email: 'Email',
    web_widget: 'Widget Web',
    instagram: 'Instagram',
    facebook: 'Facebook',
    telegram: 'Telegram',
    api: 'API',
    sms: 'SMS',
    unknown: 'Desconhecido',
  }

  return labels[channel] ?? channel
}