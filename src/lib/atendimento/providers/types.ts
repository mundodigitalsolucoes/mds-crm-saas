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
    title: 'WhatsApp Business',
    description:
      'Conexão por QR Code e sessão do WhatsApp Business. Trilha atual em operação.',
    status: 'active',
    setupMode: 'qr',
    safeToUseNow: true,
  },
  {
    id: 'whatsapp_cloud',
    title: 'WhatsApp API Oficial',
    description:
      'Trilha oficial da Meta via Atendimento, isolada da trilha WhatsApp Business.',
    status: 'active',
    setupMode: 'official_api',
    safeToUseNow: true,
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
  return (
    WHATSAPP_PROVIDER_DEFINITIONS.find((item) => item.id === provider) ??
    WHATSAPP_PROVIDER_DEFINITIONS[0]
  )
}