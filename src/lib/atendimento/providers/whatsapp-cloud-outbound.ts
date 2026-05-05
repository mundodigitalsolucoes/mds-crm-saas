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

function safeJsonParse(value: string | null): CloudInstanceMetadata | null {
  if (!value) return null

  try {
    return JSON.parse(value) as CloudInstanceMetadata
  } catch {
    return null
  }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

async function findCloudInstance(params: {
  organizationId: string
  inboxId: number
}) {
  const instance = await prisma.whatsappInstance.findFirst({
    where: {
      organizationId: params.organizationId,
      chatwootInboxId: params.inboxId,
      isActive: true,
      NOT: { status: 'archived' },
    },
    select: {
      metadata: true,
    },
  })

  if (!instance) return null

  const metadata = safeJsonParse(instance.metadata)

  if (metadata?.provider !== 'whatsapp_cloud') return null

  return {
    phoneNumberId: metadata.phoneNumberId ?? null,
    accessToken: metadata.accessToken ?? null,
  }
}

export async function sendWhatsAppCloudMessage(params: OutboundParams) {
  const { organizationId, inboxId, content, to } = params

  const instance = await findCloudInstance({ organizationId, inboxId })

  if (!instance) {
    console.warn('[WHATSAPP CLOUD OUTBOUND] Instância Cloud API não encontrada.')
    return
  }

  const { phoneNumberId, accessToken } = instance

  if (!phoneNumberId || !accessToken) {
    console.error('[WHATSAPP CLOUD OUTBOUND] Dados incompletos da instância.')
    return
  }

  const toPhone = normalizePhone(to)

  if (!toPhone || !content.trim()) {
    console.warn('[WHATSAPP CLOUD OUTBOUND] Telefone ou conteúdo vazio.')
    return
  }

  const response = await fetch(
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
          body: content.trim(),
        },
      }),
    }
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    console.error('[WHATSAPP CLOUD OUTBOUND] Erro Meta:', data)
    return
  }

  console.log('[WHATSAPP CLOUD OUTBOUND] Enviado com sucesso:', data)
}