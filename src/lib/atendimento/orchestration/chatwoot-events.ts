import { prisma } from '@/lib/prisma'
import {
  bridgeContactCreated,
  bridgeConversationCreated,
  bridgeConversationUpdated,
  bridgeIncomingMessage,
  type ChatwootWebhookPayload,
} from '@/lib/atendimento/orchestration/lead-bridge'
import { sendWhatsAppCloudMessage } from '@/lib/atendimento/providers/whatsapp-cloud-outbound'

function isIncoming(messageType: string | number | undefined) {
  return messageType === 'incoming' || messageType === 0 || messageType === '0'
}

function isOutgoing(messageType: string | number | undefined) {
  return messageType === 'outgoing' || messageType === 1 || messageType === '1'
}

function resolveContactPhone(payload: ChatwootWebhookPayload) {
  return (
    payload.conversation?.meta?.sender?.phone_number ??
    payload.contact?.phone_number ??
    payload.sender?.phone_number ??
    payload.meta?.sender?.phone_number ??
    null
  )
}

function resolveInboxId(payload: ChatwootWebhookPayload) {
  const inboxId = payload.conversation?.inbox_id ?? payload.inbox_id ?? null
  const parsed = Number(inboxId)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function isWhatsappCloudInbox(organizationId: string, inboxId: number) {
  const instance = await prisma.whatsappInstance.findFirst({
    where: {
      organizationId,
      chatwootInboxId: inboxId,
      isActive: true,
      NOT: { status: 'archived' },
    },
    select: { metadata: true },
  })

  if (!instance?.metadata) return false

  try {
    const metadata = JSON.parse(instance.metadata) as { provider?: string }
    return metadata.provider === 'whatsapp_cloud'
  } catch {
    return false
  }
}

async function processWhatsappCloudEvent(
  payload: ChatwootWebhookPayload,
  organizationId: string,
  inboxId: number
) {
  if (payload.event !== 'message_created') {
    console.log('[WHATSAPP CLOUD] Evento Chatwoot ignorado:', payload.event)
    return
  }

  if (isIncoming(payload.message_type)) {
    console.log('[WHATSAPP CLOUD] Incoming ignorado para evitar reprocessamento.')
    return
  }

  if (!isOutgoing(payload.message_type)) return

  const content = payload.content ?? ''
  const contactPhone = resolveContactPhone(payload)

  if (!content.trim()) {
    console.warn('[WHATSAPP CLOUD OUTBOUND] Evento outgoing sem conteúdo.')
    return
  }

  if (!contactPhone) {
    console.warn('[WHATSAPP CLOUD OUTBOUND] Evento outgoing sem telefone do contato.', {
      inboxId,
    })
    return
  }

  await sendWhatsAppCloudMessage({
    organizationId,
    inboxId,
    content,
    to: contactPhone,
  })
}

export async function processChatwootEvent(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  const inboxId = resolveInboxId(payload)

  if (inboxId && (await isWhatsappCloudInbox(organizationId, inboxId))) {
    await processWhatsappCloudEvent(payload, organizationId, inboxId)
    return
  }

  switch (payload.event) {
    case 'conversation_created':
      await bridgeConversationCreated(payload, organizationId)
      break

    case 'conversation_updated':
    case 'conversation_status_changed':
      await bridgeConversationUpdated(payload, organizationId)
      break

    case 'message_created': {
      if (isIncoming(payload.message_type)) {
        await bridgeIncomingMessage(payload, organizationId)
        break
      }

      break
    }

    case 'contact_created':
      await bridgeContactCreated(payload, organizationId)
      break

    default:
      console.log('[Chatwoot Webhook] Evento nao tratado:', payload.event)
  }
}