import { prisma } from '@/lib/prisma'
import { getChatwootCredentials, chatwootApi } from '@/lib/chatwoot'

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
  return digits.startsWith('55') ? `+${digits}` : `+${digits}`
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
    timeoutMs: 20_000,
    body: {
      name: input.label,
      enable_auto_assignment: true,
      timezone: 'America/Sao_Paulo',
      channel: {
        type: 'whatsapp',
        phone_number: phoneNumber,
        provider: 'whatsapp_cloud_api',
        provider_config: {
          phone_number_id: input.phoneNumberId,
          business_account_id: input.businessAccountId,
          api_key: input.accessToken,
        },
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
        chatwootAccountId: credentials.accountId,
        chatwootInboxId: inbox.id,
        chatwootChannelId: inbox.channel_id ?? null,
        configuredAt: connectedAt.toISOString(),
      }),
      isActive: true,
      connectedAt,
      disconnectedAt: null,
      lastError: null,
    },
  })

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