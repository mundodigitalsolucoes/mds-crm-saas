// src/lib/atendimento/orchestration/chatwoot-events.ts

import {
  bridgeContactCreated,
  bridgeConversationCreated,
  bridgeConversationUpdated,
  bridgeIncomingMessage,
  type ChatwootWebhookPayload,
} from '@/lib/atendimento/orchestration/lead-bridge'

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

    case 'message_created':
      await bridgeIncomingMessage(payload, organizationId)
      break

    case 'contact_created':
      await bridgeContactCreated(payload, organizationId)
      break

    default:
      console.log('[Chatwoot Webhook] Evento nao tratado:', payload.event)
  }
}