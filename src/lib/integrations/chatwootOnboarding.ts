/**
 * src/lib/integrations/chatwootOnboarding.ts
 *
 * ─── Onboarding automático do Chatwoot por org nova ──────────────────────────
 *
 * ARQUITETURA CORRIGIDA:
 * - Chatwoot CE não permite criar accounts via API REST
 * - Todas as orgs compartilham o MESMO account Chatwoot
 * - Separação por org é feita via inbox (cada org tem seu inbox próprio)
 * - Este módulo apenas salva o ConnectedAccount no banco apontando
 *   para o account central, sem chamada ao Chatwoot
 *
 * Pré-requisitos no .env / Coolify:
 *  CHATWOOT_API_URL          = https://app.mundodigitalsolucoes.com.br
 *  CHATWOOT_INTERNAL_URL     = http://chatwoot:3000 (opcional)
 *  CHATWOOT_SUPER_ADMIN_TOKEN = token do superadmin (usado como accessToken)
 *  CHATWOOT_ACCOUNT_ID       = ID do account principal (ex: 1)
 */

import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

function getChatwootConfig(): {
  publicUrl:  string
  accountId:  number
  adminToken: string
} {
  const publicUrl  = process.env.CHATWOOT_API_URL?.replace(/\/$/, '')
  const adminToken = process.env.CHATWOOT_SUPER_ADMIN_TOKEN
  const accountId  = parseInt(process.env.CHATWOOT_ACCOUNT_ID ?? '1', 10)

  if (!publicUrl)  throw new Error('CHATWOOT_API_URL não configurado.')
  if (!adminToken) throw new Error('CHATWOOT_SUPER_ADMIN_TOKEN não configurado.')

  return { publicUrl, accountId, adminToken }
}

export interface ChatwootOnboardingResult {
  success:   boolean
  accountId?: number
  error?:    string
  skipped?:  boolean
}

/**
 * Provisiona Chatwoot para uma organização nova.
 * Salva ConnectedAccount apontando para o account central do Chatwoot.
 * Chamado no signup, sem await, com .catch().
 */
export async function provisionChatwootForOrg(params: {
  organizationId: string
  orgName:        string
  ownerEmail:     string
  ownerName:      string
  connectedById:  string
}): Promise<ChatwootOnboardingResult> {
  const { organizationId, orgName, connectedById } = params

  // Verifica se já está configurado
  const existing = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { isActive: true },
  })
  if (existing?.isActive) {
    console.log(`[ChatwootOnboarding] Org ${organizationId} já tem Chatwoot — pulando.`)
    return { success: true, skipped: true }
  }

  let config: ReturnType<typeof getChatwootConfig>
  try {
    config = getChatwootConfig()
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.warn('[ChatwootOnboarding] Config ausente — provisionamento pulado:', error)
    return { success: false, error, skipped: true }
  }

  const { publicUrl, accountId, adminToken } = config

  // Salva ConnectedAccount apontando para o account central
  const data = JSON.stringify({
    chatwootUrl:       publicUrl,
    chatwootAccountId: accountId,
    provisionedAt:     new Date().toISOString(),
  })

  await prisma.connectedAccount.upsert({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    create: {
      provider:       'chatwoot',
      organizationId,
      connectedById,
      accessTokenEnc: encryptToken(adminToken),
      isActive:       true,
      data,
    },
    update: {
      accessTokenEnc: encryptToken(adminToken),
      isActive:       true,
      lastError:      null,
      lastSyncAt:     new Date(),
      data,
    },
  })

  console.log(`[ChatwootOnboarding] ✅ Chatwoot provisionado para "${orgName}" | accountId=${accountId}`)
  return { success: true, accountId }
}