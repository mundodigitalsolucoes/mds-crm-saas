// src/lib/chatwoot.ts
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto' // ← corrigido

export interface ChatwootCredentials {
  chatwootUrl: string
  accountId: number
  token: string
}

export interface ChatwootApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
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
    const token = decryptToken(account.accessTokenEnc) // ← corrigido
    const data = JSON.parse(account.data) as {
      chatwootUrl: string
      chatwootAccountId: number
    }

    if (!data.chatwootUrl || !data.chatwootAccountId || !token) return null

    return {
      chatwootUrl: data.chatwootUrl.replace(/\/$/, ''),
      accountId: data.chatwootAccountId,
      token,
    }
  } catch {
    return null
  }
}

export async function getChatwootCredentialsByAccountId(
  chatwootAccountId: number
): Promise<(ChatwootCredentials & { organizationId: string }) | null> {
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      provider: 'chatwoot',
      isActive: true,
    },
    select: {
      organizationId: true,
      accessTokenEnc: true,
      data: true,
    },
  })

  for (const account of accounts) {
    try {
      const data = JSON.parse(account.data) as {
        chatwootUrl?: string
        chatwootAccountId?: number
      }

      if (data.chatwootAccountId === chatwootAccountId) {
        const token = decryptToken(account.accessTokenEnc) // ← corrigido
        if (!token || !data.chatwootUrl) continue

        return {
          organizationId: account.organizationId,
          chatwootUrl: data.chatwootUrl.replace(/\/$/, ''),
          accountId: chatwootAccountId,
          token,
        }
      }
    } catch {
      continue
    }
  }

  return null
}

export async function chatwootApi<T = unknown>(
  credentials: ChatwootCredentials,
  path: string,
  options: ChatwootApiOptions = {}
): Promise<T> {
  const { method = 'GET', body } = options
  const url = `${credentials.chatwootUrl}/api/v1/accounts/${credentials.accountId}${path}`

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: credentials.token,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Chatwoot API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export function normalizeChatwootChannel(channel?: string | null): string {
  if (!channel) return 'unknown'
  const map: Record<string, string> = {
    'Channel::Whatsapp':     'whatsapp',
    'Channel::Email':        'email',
    'Channel::WebWidget':    'web_widget',
    'Channel::Instagram':    'instagram',
    'Channel::FacebookPage': 'facebook',
    'Channel::Telegram':     'telegram',
    'Channel::Api':          'api',
    'Channel::Sms':          'sms',
  }
  return map[channel] ?? channel.replace('Channel::', '').toLowerCase()
}

export function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    whatsapp:   'WhatsApp',
    email:      'Email',
    web_widget: 'Widget Web',
    instagram:  'Instagram',
    facebook:   'Facebook',
    telegram:   'Telegram',
    api:        'API',
    sms:        'SMS',
    unknown:    'Desconhecido',
  }
  return labels[channel] ?? channel
}
