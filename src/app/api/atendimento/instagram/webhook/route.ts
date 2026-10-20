import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'
import { claimInstagramMessage, finishInstagramMessage, instagramMessageHash } from '@/lib/atendimento/instagram-security-store'

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
    signal: AbortSignal.timeout(12000),
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
    where: { deletedAt: null },
    select: {
      id: true,
      settings: true,
      chatwootUrl: true,
    },
  })

  const matches = organizations.filter((organization) => {
    const instagram = readInstagramSettings(organization.settings)
    return instagram.instagramBusinessId === instagramBusinessId &&
      instagram.enabled === true && instagram.status === 'connected'
  })

  // An ambiguous external identifier must never select an arbitrary tenant.
  if (matches.length !== 1) return null
  return matches[0]
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
    const appSecret = process.env.META_INSTAGRAM_APP_SECRET
    if (!appSecret) return NextResponse.json({ error: 'Webhook indisponível.' }, { status: 503 })

    const signature = req.headers.get('x-hub-signature-256')
    if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
    }

    // Enforce the limit while streaming, rather than buffering an unbounded
    // request with req.text(). HMAC must cover the exact original bytes.
    const MAX_WEBHOOK_BYTES = 1024 * 1024
    const reader = req.body?.getReader()
    if (!reader) {
      return NextResponse.json({ error: 'Payload ausente.' }, { status: 400 })
    }

    const chunks: Uint8Array[] = []
    let totalBytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_WEBHOOK_BYTES) {
        await reader.cancel().catch(() => {})
        return NextResponse.json({ error: 'Payload excede o limite.' }, { status: 413 })
      }
      chunks.push(value)
    }

    const rawBytes = Buffer.concat(chunks, totalBytes)
    const expected = createHmac('sha256', appSecret).update(rawBytes).digest()
    const received = Buffer.from(signature.slice(7), 'hex')
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
    }

    const rawBody = rawBytes.toString('utf8')
    const body = JSON.parse(rawBody)

    if (body?.event) {
      return NextResponse.json({ ok: true })
    }

    const entries = Array.isArray(body?.entry) ? body.entry : []

    for (const entry of entries) {
      const instagramBusinessId = String(entry?.id || '')
      if (!instagramBusinessId) continue

      const organization = await findOrganizationByInstagramBusinessId(
        instagramBusinessId
      )

      if (!organization) continue

      const instagramSettings = readInstagramSettings(organization.settings)
      const inboxId = toPositiveInt(instagramSettings.chatwootInboxId)
      if (!inboxId) continue

      const chatwootAccount = await prisma.connectedAccount.findUnique({
        where: {
          provider_organizationId: {
            provider: 'chatwoot',
            organizationId: organization.id,
          },
        },
      })

      // Never dispatch to a provider connection explicitly disabled by the tenant.
      if (!chatwootAccount?.isActive || !chatwootAccount.accessTokenEnc) continue

      const chatwootData = parseChatwootAccountData(chatwootAccount.data)
      const accountId = toPositiveInt(chatwootData?.chatwootAccountId)
      if (!accountId) continue

      const apiBaseUrl =
        normalizeBaseUrl(process.env.CHATWOOT_INTERNAL_URL) ||
        normalizeBaseUrl(organization.chatwootUrl) ||
        normalizeBaseUrl(chatwootData?.chatwootUrl)

      if (!apiBaseUrl) continue

      const apiToken = decryptToken(chatwootAccount.accessTokenEnc)
      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : []

      for (const event of messaging) {
        // Meta may deliver echoes of our own outbound messages. They must not
        // be re-imported as inbound messages in Chatwoot.
        if (event?.message?.is_echo === true) continue

        const senderId = String(event?.sender?.id || '')
        const messageText = String(event?.message?.text || '').trim()

        if (!senderId || !messageText || senderId === instagramBusinessId) continue

        const messageId = event?.message?.mid
        if (typeof messageId !== 'string' || !messageId || messageId.length > 1024) {
          return NextResponse.json({ error: 'INSTAGRAM_MESSAGE_ID_REQUIRED' }, { status: 400 })
        }
        const receipt = {
          organizationId: organization.id,
          eventHash: instagramMessageHash(instagramBusinessId, senderId, messageId),
          chatwootAccountId: accountId,
          chatwootInboxId: inboxId,
        }
        const claim = await claimInstagramMessage(receipt)
        if (claim === 'completed') continue
        if (claim === 'unresolved') {
          return NextResponse.json({ error: 'INSTAGRAM_DELIVERY_RECONCILIATION_REQUIRED' }, { status: 503 })
        }

        try {
          const contact = await createChatwootContact({
            apiBaseUrl,
            accountId,
            apiToken,
            inboxId,
            senderId,
            senderName: `Instagram ${senderId}`,
          })

          const contactId =
            toPositiveInt(contact?.payload?.contact?.id) ||
            toPositiveInt(contact?.id)

          if (!contactId) throw new Error('INSTAGRAM_CONTACT_ID_MISSING')

          const conversation = await createChatwootConversation({
            apiBaseUrl,
            accountId,
            apiToken,
            inboxId,
            contactId,
            sourceId: `instagram:${senderId}`,
          })

          const conversationId = toPositiveInt(conversation.id)
          if (!conversationId) throw new Error('INSTAGRAM_CONVERSATION_ID_MISSING')

          await createChatwootMessage({
            apiBaseUrl,
            accountId,
            apiToken,
            conversationId,
            content: messageText,
          })

          await finishInstagramMessage(receipt, 'completed')
        } catch {
          // A provider timeout or failed local completion has an uncertain
          // remote result. Retain the receipt; never blindly dispatch again.
          await finishInstagramMessage(receipt, 'remote_unknown').catch(() => {})
          throw new Error('INSTAGRAM_DELIVERY_UNRESOLVED')
        }

        console.info('[Instagram → Atendimento] Mensagem encaminhada com sucesso')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro webhook Instagram:', error instanceof Error ? error.name : 'unknown_error')

    return NextResponse.json(
      { error: 'WEBHOOK_FAILED' },
      { status: 500 }
    )
  }
}
