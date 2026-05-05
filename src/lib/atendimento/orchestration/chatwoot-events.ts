import {
  bridgeContactCreated,
  bridgeConversationCreated,
  bridgeConversationUpdated,
  bridgeIncomingMessage,
  type ChatwootWebhookPayload,
} from '@/lib/atendimento/orchestration/lead-bridge'

import { sendWhatsAppCloudMessage } from '@/lib/atendimento/providers/whatsapp-cloud-outbound'

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
      const messageType = payload.message_type
      const inboxId = payload.conversation?.inbox_id
      const content = payload.content
      const contactPhone = payload.conversation?.meta?.sender?.phone_number

      // INBOUND (já funciona)
      if (messageType === 'incoming') {
        await bridgeIncomingMessage(payload, organizationId)
        break
      }

      // OUTBOUND (novo)
      if (
        messageType === 'outgoing' &&
        inboxId &&
        content &&
        contactPhone
      ) {
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