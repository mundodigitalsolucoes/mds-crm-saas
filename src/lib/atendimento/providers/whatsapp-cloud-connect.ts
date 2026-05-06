import { prisma } from '@/lib/prisma'
import { getChatwootCredentials, chatwootApi } from '@/lib/chatwoot'
import { ensureChatwootWebhookForOrganization } from '@/lib/atendimento/orchestration/chatwoot-webhooks'

type ConnectWhatsappCloudInput = {
  organizationId: string
  userId: string
  label: string
  phoneNumber: string
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
}

type ChatwootInbox = {
  id: number
  name: string
  channel_type?: string
  channel_id?: number
  provider?: string
  phone_number?: string
}

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

function buildCloudInstanceName(slug: string) {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  return `cloud-${slug}-${suffix}`.toLowerCase()
}

export async function connectWhatsappCloudOfficial(input: ConnectWhatsappCloudInput) {
  const credentials = await getChatwootCredentials(input.organizationId)

  if (!credentials) {
    throw new Error('Atendimento não configurado para esta organização.')
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { slug: true },
  })

  if (!org) {
    throw new Error('Organização não encontrada.')
  }

  const phoneNumber = normalizePhoneNumber(input.phoneNumber)

  if (!phoneNumber) {
    throw new Error('Número de WhatsApp inválido.')
  }

  const duplicated = await prisma.whatsappInstance.findFirst({
    where: {
      organizationId: input.organizationId,
      phoneNumber,
      isActive: true,
      NOT: { status: 'archived' },
    },
    select: { id: true },
  })

  if (duplicated) {
    throw new Error('Este número já possui canal ativo nesta organização.')
  }

  const inbox = await chatwootApi<ChatwootInbox>(credentials, '/inboxes', {
    method: 'POST',
    timeoutMs: 20000,
    body: {
      name: input.label,
      enable_auto_assignment: true,
      timezone: 'America/Sao_Paulo',
      channel: {
        type: 'api',
      },
    },
  })

  if (!inbox?.id) {
    throw new Error('Atendimento não retornou o ID da inbox.')
  }

  const instanceName = buildCloudInstanceName(org.slug)
  const connectedAt = new Date()

  const instance = await prisma.whatsappInstance.create({
    data: {
      organizationId: input.organizationId,
      connectedById: input.userId,
      label: input.label,
      instanceName,
      phoneNumber,
      status: 'connected',
      chatwootInboxId: inbox.id,
      serverUrl: credentials.chatwootUrl,
      metadata: JSON.stringify({
        provider: 'whatsapp_cloud',
        phoneNumber,
        phoneNumberId: input.phoneNumberId,
        businessAccountId: input.businessAccountId,
        accessToken: input.accessToken,
        chatwootAccountId: credentials.accountId,
        chatwootInboxId: inbox.id,
        chatwootChannelId: inbox.channel_id ?? null,
        webhookStatus: 'pending',
        configuredAt: connectedAt.toISOString(),
      }),
      isActive: true,
      connectedAt,
      disconnectedAt: null,
      lastError: null,
    },
  })

  try {
    await ensureChatwootWebhookForOrganization(credentials)

    await prisma.whatsappInstance.update({
      where: { id: instance.id },
      data: {
        metadata: JSON.stringify({
          provider: 'whatsapp_cloud',
          phoneNumber,
          phoneNumberId: input.phoneNumberId,
          businessAccountId: input.businessAccountId,
          accessToken: input.accessToken,
          chatwootAccountId: credentials.accountId,
          chatwootInboxId: inbox.id,
          chatwootChannelId: inbox.channel_id ?? null,
          webhookStatus: 'configured',
          configuredAt: connectedAt.toISOString(),
          webhookConfiguredAt: new Date().toISOString(),
        }),
      },
    })
  } catch (error) {
    console.warn('[WHATSAPP CLOUD CONNECT] Webhook do Chatwoot não configurado automaticamente.', {
      organizationId: input.organizationId,
      inboxId: inbox.id,
      error: error instanceof Error ? error.message : error,
    })
  }

  return {
    success: true,
    provider: 'whatsapp_cloud',
    instanceId: instance.id,
    instanceName: instance.instanceName,
    label: instance.label,
    phoneNumber: instance.phoneNumber,
    chatwootInboxId: instance.chatwootInboxId,
    status: 'active',
  }
}