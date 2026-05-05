import { prisma } from '@/lib/prisma'

type OutboundParams = {
  organizationId: string
  inboxId: number
  content: string
  to: string
}

type CloudInstanceMetadata = {
  provider?: string
  phoneNumberId?: string
  accessToken?: string
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

async function findCloudInstance(inboxId: number) {
  const instance = await prisma.whatsappInstance.findFirst({
    where: {
      chatwootInboxId: inboxId,
      isActive: true,
    },
  })

  if (!instance) return null

  const metadata = instance.metadata
    ? (JSON.parse(instance.metadata) as CloudInstanceMetadata)
    : null

  if (metadata?.provider !== 'whatsapp_cloud') return null

  return {
    phoneNumberId: metadata.phoneNumberId,
    accessToken: metadata.accessToken,
  }
}

export async function sendWhatsAppCloudMessage(params: OutboundParams) {
  const { inboxId, content, to } = params

  const instance = await findCloudInstance(inboxId)

  if (!instance) {
    console.warn('[WHATSAPP CLOUD OUTBOUND] Instância não encontrada')
    return
  }

  const { phoneNumberId, accessToken } = instance

  if (!phoneNumberId || !accessToken) {
    console.error('[WHATSAPP CLOUD OUTBOUND] Dados incompletos')
    return
  }

  const toPhone = normalizePhone(to)

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toPhone,
          type: 'text',
          text: {
            body: content,
          },
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      console.error('[WHATSAPP CLOUD OUTBOUND] Erro Meta:', data)
    } else {
      console.log('[WHATSAPP CLOUD OUTBOUND] Enviado com sucesso')
    }
  } catch (err) {
    console.error('[WHATSAPP CLOUD OUTBOUND] Erro envio:', err)
  }
}