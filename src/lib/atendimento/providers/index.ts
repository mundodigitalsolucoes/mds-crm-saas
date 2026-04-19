// src/lib/atendimento/providers/index.ts

import {
  getWhatsappProviderDefinition,
  resolveWhatsappProvider,
  type WhatsappProvider,
} from '@/lib/atendimento/providers/types'
import { connectWhatsappEvolutionProvider } from '@/lib/atendimento/providers/evolution'
import { connectWhatsappCloudProvider } from '@/lib/atendimento/providers/whatsapp-cloud'

export type ProviderConnectInput = {
  provider: WhatsappProvider
  organizationId: string
  userId: string
  label: string
  evoUrl: string
  evoKey: string
}

export function resolveRequestedWhatsappProvider(value: unknown): WhatsappProvider {
  return resolveWhatsappProvider(value)
}

export function listWhatsappProviders() {
  return ['evolution', 'whatsapp_cloud'].map((provider) =>
    getWhatsappProviderDefinition(provider as WhatsappProvider)
  )
}

export async function connectWhatsappByProvider(input: ProviderConnectInput) {
  const { provider, organizationId, userId, label, evoUrl, evoKey } = input

  if (provider === 'whatsapp_cloud') {
    return connectWhatsappCloudProvider({
      organizationId,
      userId,
      label,
    })
  }

  return connectWhatsappEvolutionProvider({
    organizationId,
    userId,
    label,
    evoUrl,
    evoKey,
  })
}