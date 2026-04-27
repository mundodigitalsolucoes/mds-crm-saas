import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

type ChatwootAccountData = {
  chatwootAccountId?: number | string
  chatwootUrl?: string
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeBaseUrl(url?: string | null) {
  return url?.trim().replace(/\/$/, '') || null
}

function toPositiveInt(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
  return num
}

function parseChatwootAccountData(raw: string): ChatwootAccountData | null {
  return safeJsonParse<ChatwootAccountData>(raw)
}

function readInstagramSettings(settings: string | null) {
  const parsed = safeJsonParse<Record<string, unknown>>(settings) ?? {}

  return parsed.atendimentoInstagram &&
    typeof parsed.atendimentoInstagram === 'object'
    ? (parsed.atendimentoInstagram as Record<string, unknown>)
    : {}
}

async function chatwootRequest<T>(params: {
  url: string
  apiToken: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
}): Promise<T> {
  const response = await fetch(params.url, {
    method: params.method,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: params.apiToken,
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })

  const text = await response.text().catch(() => '')
  const json = text ? safeJsonParse<T>(text) : null

  if (!response.ok) {
    throw new Error(text || `chatwoot_http_${response.status}`)
  }

  return (json ?? {}) as T
}

async function findOrganizationByInstagramBusinessId(instagramBusinessId: string) {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      settings: true,
      chatwootAccountId: true,
      chatwootUrl: true,
    },
  })

  return organizations.find((organization) => {
    const instagram = readInstagramSettings(organization.settings)

    return (
      typeof instagram.instagramBusinessId === 'string' &&
      instagram.instagramBusinessId === instagramBusinessId
    )
  })
}

async function createChatwootContact(params: {
  apiBaseUrl: string
  accountId: number
  apiToken: string
  inboxId: number
  senderId: string
  senderName: string
}) {
  return chatwootRequest<{ payload?: { contact?: { id?: number } }; id?: number }>({
    url: `${params.apiBaseUrl}/api/v1/accounts/${params.accountId}/contacts`,
    apiToken: params.apiToken,
    method: 'POST',
    body: {
      inbox_id: params.inboxId,
      name: params.senderName,
      identifier: `instagram:${params.senderId}`,
      custom_attributes: {
        instagram_sender_id: params.senderId,
        source: 'instagram',
      },
    },
  })
}

async function createChatwootConversation(params: {
  apiBaseUrl: string
  accountId: number
  apiToken: string
  inboxId: number
  contactId: number
  sourceId: string
}) {
  return chatwootRequest<{ id?: number }>({
    url: `${params.apiBaseUrl}/api/v1/accounts/${params.accountId}/conversations`,
    apiToken: params.apiToken,
    method: 'POST',
    body: {
      inbox_id: params.inboxId,
      contact_id: params.contactId,
      source_id: params.sourceId,
    },
  })
}

async function createChatwootMessage(params: {
  apiBaseUrl: string
  accountId: number
  apiToken: string
  conversationId: number
  content: string
}) {
  return chatwootRequest({
    url: `${params.apiBaseUrl}/api/v1/accounts/${params.accountId}/conversations/${params.conversationId}/messages`,
    apiToken: params.apiToken,
    method: 'POST',
    body: {
      content: params.content,
      message_type: 'incoming',
      private: false,
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expectedToken = process.env.META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN ausente.' },
      { status: 500 }
    )
  }

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Webhook inválido.' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body?.event) {
      console.log('Webhook Chatwoot ignorado nesta ponte:', body.event)
      return NextResponse.json({ ok: true, ignored: 'chatwoot_event' })
    }

    const entries = Array.isArray(body?.entry) ? body.entry : []

    for (const entry of entries) {
      const instagramBusinessId = String(entry?.id || '')
      if (!instagramBusinessId) continue

      const organization = await findOrganizationByInstagramBusinessId(
        instagramBusinessId
      )

      if (!organization) {
        console.warn(
          'Organização não encontrada para Instagram Business ID:',
          instagramBusinessId
        )
        continue
      }

      const instagramSettings = readInstagramSettings(organization.settings)
      const inboxId = toPositiveInt(instagramSettings.chatwootInboxId)

      if (!inboxId) {
        console.warn('Inbox do Instagram não provisionada para org:', organization.id)
        continue
      }

      const chatwootAccount = await prisma.connectedAccount.findUnique({
        where: {
          provider_organizationId: {
            provider: 'chatwoot',
            organizationId: organization.id,
          },
        },
        select: {
          isActive: true,
          accessTokenEnc: true,
          data: true,
        },
      })

      if (!chatwootAccount?.isActive || !chatwootAccount.accessTokenEnc) {
        console.warn('Atendimento não conectado para org:', organization.id)
        continue
      }

      const chatwootData = parseChatwootAccountData(chatwootAccount.data)
      const accountId = toPositiveInt(chatwootData?.chatwootAccountId)

      if (!accountId) {
        console.warn('chatwootAccountId ausente para org:', organization.id)
        continue
      }

      const apiBaseUrl =
        normalizeBaseUrl(process.env.CHATWOOT_INTERNAL_URL) ||
        normalizeBaseUrl(organization.chatwootUrl) ||
        normalizeBaseUrl(chatwootData?.chatwootUrl)

      if (!apiBaseUrl) {
        console.warn('Base URL Atendimento ausente para org:', organization.id)
        continue
      }

      const apiToken = decryptToken(chatwootAccount.accessTokenEnc)
      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : []

      for (const event of messaging) {
        const senderId = String(event?.sender?.id || '')
        const messageText = String(event?.message?.text || '').trim()
        const messageId = String(event?.message?.mid || '')

        if (!senderId || !messageText) continue

        const contactResponse = await createChatwootContact({
          apiBaseUrl,
          accountId,
          apiToken,
          inboxId,
          senderId,
          senderName: `Instagram ${senderId}`,
        })

        const contactId =
          toPositiveInt(contactResponse?.payload?.contact?.id) ||
          toPositiveInt(contactResponse?.id)

        if (!contactId) {
          console.warn('Contato Chatwoot não criado para sender:', senderId)
          continue
        }

        const conversationResponse = await createChatwootConversation({
          apiBaseUrl,
          accountId,
          apiToken,
          inboxId,
          contactId,
          sourceId: `instagram:${senderId}`,
        })

        const conversationId = toPositiveInt(conversationResponse.id)

        if (!conversationId) {
          console.warn('Conversa Chatwoot não criada para sender:', senderId)
          continue
        }

        await createChatwootMessage({
          apiBaseUrl,
          accountId,
          apiToken,
          conversationId,
          content: messageText,
        })

        console.log('Mensagem Instagram enviada ao Atendimento:', {
          organizationId: organization.id,
          instagramBusinessId,
          senderId,
          messageId,
          inboxId,
          conversationId,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro na ponte Meta → Atendimento:', error)

    return NextResponse.json(
      {
        error: 'META_TO_CHATWOOT_BRIDGE_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao processar webhook.',
      },
      { status: 500 }
    )
  }
}