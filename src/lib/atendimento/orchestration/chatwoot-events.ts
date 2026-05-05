import { prisma } from '@/lib/prisma'
import { sendWhatsAppCloudMessage } from '@/lib/atendimento/providers/whatsapp-cloud-outbound'

export async function processChatwootEvent(payload: any, organizationId?: string) {
  try {
    console.log('[Chatwoot] Evento recebido:', payload?.event)

    // Só processa mensagens
    if (payload?.event !== 'message_created') return

    // Só mensagens enviadas pelo agente
    if (payload?.message_type !== 'outgoing') return

    const content = payload?.content
    if (!content) return

    const inboxId = payload?.conversation?.inbox_id

    if (!inboxId) {
      console.warn('[OUTBOUND] inbox_id ausente')
      return
    }

    const instance = await prisma.whatsappInstance.findFirst({
      where: {
        chatwootInboxId: Number(inboxId),
        isActive: true,
      },
    })

    if (!instance) {
      console.warn('[OUTBOUND] instância não encontrada para inbox:', inboxId)
      return
    }

    let metadata: any = {}
    try {
      metadata = JSON.parse(instance.metadata || '{}')
    } catch {
      console.warn('[OUTBOUND] erro ao parsear metadata')
    }

    if (metadata.provider !== 'whatsapp_cloud') return

    console.log('[OUTBOUND] Disparando envio', {
      instanceId: instance.id,
      inboxId,
    })

    await sendWhatsAppCloudMessage({
      instance,
      content,
    })

    console.log('[OUTBOUND] Enviado com sucesso')
  } catch (error) {
    console.error('[OUTBOUND] Erro geral:', error)
  }
}