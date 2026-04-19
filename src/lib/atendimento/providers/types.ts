// src/lib/atendimento/providers/types.ts

export type WhatsappProvider = 'evolution' | 'whatsapp_cloud'

export type WhatsappProviderStatus = 'active' | 'planned'

export type WhatsappProviderDefinition = {
  id: WhatsappProvider
  title: string
  description: string
  status: WhatsappProviderStatus
  setupMode: 'qr' | 'official_api'
  safeToUseNow: boolean
}

export const WHATSAPP_PROVIDER_DEFINITIONS: WhatsappProviderDefinition[] = [
  {
    id: 'evolution',
    title: 'WhatsApp via Evolution',
    description:
      'Conexão por QR Code e sessão do WhatsApp Business. Trilha atual em operação e homologação contínua.',
    status: 'active',
    setupMode: 'qr',
    safeToUseNow: true,
  },
  {
    id: 'whatsapp_cloud',
    title: 'WhatsApp Cloud API',
    description:
      'Trilha oficial separada para API da Meta no contexto do Chatwoot. Reservada para a próxima etapa de ativação.',
    status: 'planned',
    setupMode: 'official_api',
    safeToUseNow: false,
  },
]

export function isWhatsappProvider(value: unknown): value is WhatsappProvider {
  return value === 'evolution' || value === 'whatsapp_cloud'
}

export function resolveWhatsappProvider(value: unknown): WhatsappProvider {
  if (isWhatsappProvider(value)) return value
  return 'evolution'
}

export function getWhatsappProviderDefinition(
  provider: WhatsappProvider
): WhatsappProviderDefinition {
  const found = WHATSAPP_PROVIDER_DEFINITIONS.find((item) => item.id === provider)

  if (!found) {
    return WHATSAPP_PROVIDER_DEFINITIONS[0]
  }

  return found
}