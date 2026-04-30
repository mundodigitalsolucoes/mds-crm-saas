import { prisma } from '@/lib/prisma'
import { chatwootApi, getChatwootCredentials } from '@/lib/chatwoot'

type WhatsAppCloudWebhookPayload = {
  object?: string
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string
          display_phone_number?: string
        }
        contacts?: Array<{
          wa_id?: string
          profile?: {
            name?: string
          }
        }>
        messages?: Array<WhatsAppCloudMessage>
        statuses?: unknown[]
      }
    }>
  }>
}

type WhatsAppCloudMessage = {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: {
    body?: string
  }
  image?: WhatsAppCloudMedia
  audio?: WhatsAppCloudMedia
  video?: WhatsAppCloudMedia
  document?: WhatsAppCloudMedia & {
    filename?: string
  }
  sticker?: WhatsAppCloudMedia
}

type WhatsAppCloudMedia = {
  id?: string
  mime_type?: string
  sha256?: string
  caption?: string
}

type CloudInstanceMetadata = {
  provider?: string
  phoneNumber?: string
  phoneNumberId?: string
  businessAccountId?: string
  accessToken?: string
  chatwootAccountId?: number
  chatwootInboxId?: number
  processedMessageIds?: string[]
}

type ChatwootContact = {
  id: number
  name?: string
  phone_number?: string
  identifier?: string
}

type ChatwootContactResponse = {
  id?: number
  payload?: ChatwootContact[]
}

type ChatwootConversation = {
  id: number
  account_id?: number
  inbox_id?: number
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

function getMediaFromMessage(message: WhatsAppCloudMessage): WhatsAppCloudMedia | null {
  if (message.image) return message.image
  if (message.audio) return message.audio
  if (message.video) return message.video
  if (message.document) return message.document
  if (message.sticker) return message.sticker
  return null
}

function buildSourceId(phone: string) {
  return `wa_cloud_${phone.replace(/\D/g, '')}`
}

function buildMessageContent(params: {
  message: WhatsAppCloudMessage
  mediaUrl?: string | null
}) {
  const { message, mediaUrl } = params
  const type = message.type ?? 'unknown'
  const media = getMediaFromMessage(message)

  if (type === 'text') {
    return message.text?.body?.trim() || '[mensagem sem texto]'
  }

  const caption = media?.caption?.trim()
  const parts = [`[${type} recebido via WhatsApp API Oficial]`]

  if (caption) parts.push(caption)
  if (media?.mime_type) parts.push(`Tipo: ${media.mime_type}`)
  if (mediaUrl) parts.push(`Arquivo temporário Meta: ${mediaUrl}`)

  return parts.join('\n')
}

async function fetchMetaMediaUrl(params: {
  mediaId?: string
  accessToken?: string
}) {
  const { mediaId, accessToken } = params

  if (!mediaId || !accessToken) return null

  try {
    const response = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const data = (await response.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

async function findCloudInstanceByPhoneNumberId(phoneNumberId: string) {
  const instances = await prisma.whatsappInstance.findMany({
    where: {
      isActive: true,
      NOT: { status: 'archived' },
    },
    select: {
      id: true,
      organizationId: true,
      label: true,
      phoneNumber: true,
      chatwootInboxId: true,
      metadata: true,
    },
  })

  for (const instance of instances) {
    const metadata = safeJsonParse<CloudInstanceMetadata>(instance.metadata)

    if (
      metadata?.provider === 'whatsapp_cloud' &&
      metadata.phoneNumberId === phoneNumberId &&
      instance.chatwootInboxId
    ) {
      return { instance, metadata }
    }
  }

  return null
}

async function ensureChatwootContact(params: {
  organizationId: string
  inboxId: number
  customerPhone: string
  customerName: string
}) {
  const { organizationId, inboxId, customerPhone, customerName } = params
  const credentials = await getChatwootCredentials(organizationId)

  if (!credentials) {
    throw new Error('Atendimento não configurado para esta organização.')
  }

  const search = await chatwootApi<{ payload?: ChatwootContact[] }>(
    credentials,
    `/contacts/search?q=${encodeURIComponent(customerPhone)}`
  ).catch(() => ({ payload: [] }))

  const existing = search.payload?.find(
    (contact) =>
      contact.phone_number === customerPhone ||
      contact.identifier === buildSourceId(customerPhone)
  )

  if (existing?.id) {
    return { credentials, contact: existing }
  }

  const created = await chatwootApi<ChatwootContactResponse>(credentials, '/contacts', {
    method: 'POST',
    timeoutMs: 15000,
    body: {
      inbox_id: inboxId,
      name: customerName,
      phone_number: customerPhone,
      identifier: buildSourceId(customerPhone),
      custom_attributes: {
        source: 'whatsapp_cloud',
      },
    },
  })

  const contact = created.payload?.[0] ?? created

  if (!contact?.id) {
    throw new Error('Atendimento não retornou o contato criado.')
  }

  return { credentials, contact: contact as ChatwootContact }
}

async function ensureConversation(params: {
  organizationId: string
  inboxId: number
  contactId: number
  sourceId: string
}) {
  const { organizationId, inboxId, contactId, sourceId } = params
  const credentials = await getChatwootCredentials(organizationId)

  if (!credentials) {
    throw new Error('Atendimento não configurado para esta organização.')
  }

  const conversations = await chatwootApi<{ payload?: ChatwootConversation[] }>(
    credentials,
    `/contacts/${contactId}/conversations`
  ).catch(() => ({ payload: [] }))

  const openConversation = conversations.payload?.find(
    (conversation) => conversation.inbox_id === inboxId
  )

  if (openConversation?.id) {
    return { credentials, conversation: openConversation }
  }

  const created = await chatwootApi<ChatwootConversation>(credentials, '/conversations', {
    method: 'POST',
    timeoutMs: 15000,
    body: {
      source_id: sourceId,
      inbox_id: inboxId,
      contact_id: contactId,
      status: 'open',
      custom_attributes: {
        provider: 'whatsapp_cloud',
      },
    },
  })

  if (!created?.id) {
    throw new Error('Atendimento não retornou a conversa criada.')
  }

  return { credentials, conversation: created }
}

async function createIncomingMessage(params: {
  organizationId: string
  conversationId: number
  content: string
  metaMessageId: string
}) {
  const { organizationId, conversationId, content, metaMessageId } = params
  const credentials = await getChatwootCredentials(organizationId)

  if (!credentials) {
    throw new Error('Atendimento não configurado para esta organização.')
  }

  await chatwootApi(credentials, `/conversations/${conversationId}/messages`, {
    method: 'POST',
    timeoutMs: 15000,
    body: {
      content,
      message_type: 'incoming',
      private: false,
      content_type: 'text',
      content_attributes: {
        provider: 'whatsapp_cloud',
        metaMessageId,
      },
    },
  })
}

async function markMessageProcessed(params: {
  instanceId: string
  metadata: CloudInstanceMetadata
  messageId: string
}) {
  const current = Array.isArray(params.metadata.processedMessageIds)
    ? params.metadata.processedMessageIds
    : []

  const next = [params.messageId, ...current.filter((id) => id !== params.messageId)].slice(0, 50)

  await prisma.whatsappInstance.update({
    where: { id: params.instanceId },
    data: {
      metadata: JSON.stringify({
        ...params.metadata,
        processedMessageIds: next,
        lastInboundAt: new Date().toISOString(),
      }),
    },
  })
}

export async function processWhatsAppCloudWebhook(payload: WhatsAppCloudWebhookPayload) {
  const results: Array<{
    success: boolean
    messageId?: string
    error?: string
  }> = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId = value?.metadata?.phone_number_id

      if (!phoneNumberId) continue

      const resolved = await findCloudInstanceByPhoneNumberId(phoneNumberId)

      if (!resolved) {
        console.warn('[WHATSAPP CLOUD INBOUND] Instância não encontrada', { phoneNumberId })
        continue
      }

      const { instance, metadata } = resolved

      for (const message of value?.messages ?? []) {
        const messageId = message.id

        if (!messageId) continue

        if (metadata.processedMessageIds?.includes(messageId)) {
          results.push({ success: true, messageId })
          continue
        }

        try {
          const customerPhone = normalizePhone(message.from)
          const contactName =
            value.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name ??
            customerPhone

          if (!customerPhone) {
            throw new Error('Mensagem sem telefone de origem.')
          }

          const inboxId = instance.chatwootInboxId

          if (!inboxId) {
            throw new Error('Instância sem chatwootInboxId.')
          }

          const media = getMediaFromMessage(message)
          const mediaUrl = await fetchMetaMediaUrl({
            mediaId: media?.id,
            accessToken: metadata.accessToken,
          })

          const content = buildMessageContent({ message, mediaUrl })

          const { contact } = await ensureChatwootContact({
            organizationId: instance.organizationId,
            inboxId,
            customerPhone,
            customerName: contactName,
          })

          const sourceId = buildSourceId(customerPhone)

          const { conversation } = await ensureConversation({
            organizationId: instance.organizationId,
            inboxId,
            contactId: contact.id,
            sourceId,
          })

          await createIncomingMessage({
            organizationId: instance.organizationId,
            conversationId: conversation.id,
            content,
            metaMessageId: messageId,
          })

          await markMessageProcessed({
            instanceId: instance.id,
            metadata,
            messageId,
          })

          results.push({ success: true, messageId })
        } catch (error) {
          results.push({
            success: false,
            messageId,
            error: error instanceof Error ? error.message : 'Erro inesperado.',
          })

          console.error('[WHATSAPP CLOUD INBOUND] Erro ao processar mensagem', error)
        }
      }
    }
  }

  return {
    success: true,
    results,
  }
}