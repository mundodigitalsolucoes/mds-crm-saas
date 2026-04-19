// src/lib/atendimento/providers/evolution.ts

import { ChannelLifecycleError, connectWhatsappChannel } from '@/lib/atendimento/orchestration/channel-lifecycle'

export type EvolutionProviderConnectInput = {
  organizationId: string
  userId: string
  label: string
  evoUrl: string
  evoKey: string
}

export function assertEvolutionProviderConfigured(params: {
  evoUrl: string
  evoKey: string
}) {
  const { evoUrl, evoKey } = params

  if (!evoUrl || !evoKey) {
    throw new ChannelLifecycleError('Servidor WhatsApp não configurado.', 500)
  }
}

export async function connectWhatsappEvolutionProvider(
  input: EvolutionProviderConnectInput
) {
  return connectWhatsappChannel(input)
}