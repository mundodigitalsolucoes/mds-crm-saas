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

export async function processChatwootEvent(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
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

      if (isOutgoing(payload.message_type)) {
        const inboxId = resolveInboxId(payload)
        const content = payload.content ?? ''
        const contactPhone = resolveContactPhone(payload)

        if (!inboxId) {
          console.warn('[WHATSAPP CLOUD OUTBOUND] Evento outgoing sem inbox_id.')
          break
        }

        if (!content.trim()) {
          console.warn('[WHATSAPP CLOUD OUTBOUND] Evento outgoing sem conteúdo.')
          break
        }

        if (!contactPhone) {
          console.warn('[WHATSAPP CLOUD OUTBOUND] Evento outgoing sem telefone do contato.', {
            inboxId,
          })
          break
        }

        await sendWhatsAppCloudMessage({
          organizationId,
          inboxId,
          content,
          to: contactPhone,
        })
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
