// src/lib/atendimento/providers/whatsapp-cloud.ts

import { ChannelLifecycleError } from '@/lib/atendimento/orchestration/channel-lifecycle'

export type WhatsappCloudProviderConnectInput = {
  organizationId: string
  userId: string
  label: string
}

export async function connectWhatsappCloudProvider(
  _input: WhatsappCloudProviderConnectInput
) {
  throw new ChannelLifecycleError(
    'Provider WhatsApp Cloud ainda não foi habilitado nesta fase. A trilha Evolution segue isolada e operante.',
    501,
    'WHATSAPP_CLOUD_NOT_ENABLED'
  )
}