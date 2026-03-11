// src/lib/integrations/chatwoot-provision.ts
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

interface ProvisionInput {
  organizationId: string
  orgName:        string
  orgSlug:        string
  ownerUserId:    string
  ownerName:      string
  ownerEmail:     string
  ownerPassword:  string
}

interface ProvisionResult {
  success:            boolean
  chatwootAccountId?: number
  chatwootUserId?:    number
  error?:             string
}

/**
 * Confirma o usuário via endpoint customizado no SSO controller do Chatwoot.
 * Usa CHATWOOT_SUPER_ADMIN_TOKEN como segredo — sem SQL direto, sem ETIMEDOUT.
 */
async function confirmChatwootUser(baseUrl: string, email: string): Promise<void> {
  const secret = process.env.CHATWOOT_SUPER_ADMIN_TOKEN
  if (!secret) {
    console.warn('[CHATWOOT PROVISION] CHATWOOT_SUPER_ADMIN_TOKEN não configurado')
    return
  }

  try {
    const res = await fetch(
      `${baseUrl}/sso/confirm-user?email=${encodeURIComponent(email)}&secret=${encodeURIComponent(secret)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (res.ok) {
      const json = await res.json()
      console.info(`[CHATWOOT PROVISION] ✅ Usuário ${email} confirmado — ID #${json.user_id}`)
    } else {
      console.warn(`[CHATWOOT PROVISION] Confirmação retornou ${res.status}`)
    }
  } catch (err) {
    console.warn('[CHATWOOT PROVISION] Falha ao confirmar usuário:', err)
  }
}

export async function provisionChatwootForOrg(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const chatwootUrl = process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '')
  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl     = internalUrl ?? chatwootUrl

  if (!baseUrl) {
    console.info('[CHATWOOT PROVISION] URL não configurada')
    return { success: false, error: 'super_admin_not_configured' }
  }

  try {
    // 1. Cria account + usuário via API pública do Chatwoot
    const res = await fetch(`${baseUrl}/api/v1/accounts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_name:          input.orgName,
        email:                 input.ownerEmail,
        password:              input.ownerPassword,
        password_confirmation: input.ownerPassword,
        locale:                'pt_BR',
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn('[CHATWOOT PROVISION] Falha criar account:', res.status, errText)
      return { success: false, error: 'account_creation_failed' }
    }

    const json = await res.json()
    const data = json?.data

    if (!data?.account_id || !data?.access_token) {
      console.warn('[CHATWOOT PROVISION] Resposta inesperada:', JSON.stringify(json))
      return { success: false, error: 'account_creation_failed' }
    }

    const chatwootAccountId = data.account_id as number
    const chatwootUserId    = data.id          as number
    const accessToken       = data.access_token as string

    // 2. Confirma o usuário via endpoint SSO customizado
    await confirmChatwootUser(baseUrl, input.ownerEmail)

    // 3. Salva no banco do CRM
    const publicUrl   = chatwootUrl ?? baseUrl
    const encToken    = encryptToken(accessToken)
    const encPassword = encryptToken(input.ownerPassword)

    await prisma.$transaction([
      prisma.connectedAccount.upsert({
        where: {
          provider_organizationId: {
            provider:       'chatwoot',
            organizationId: input.organizationId,
          },
        },
        create: {
          provider:       'chatwoot',
          organizationId: input.organizationId,
          connectedById:  input.ownerUserId,
          accessTokenEnc: encToken,
          isActive:       true,
          data: JSON.stringify({
            chatwootUrl:      publicUrl,
            chatwootAccountId,
            ownerEmail:       input.ownerEmail,
            ownerPasswordEnc: encPassword,
            chatwootUserId,
          }),
        },
        update: {
          accessTokenEnc: encToken,
          isActive:       true,
          lastError:      null,
          lastSyncAt:     new Date(),
          data: JSON.stringify({
            chatwootUrl:      publicUrl,
            chatwootAccountId,
            ownerEmail:       input.ownerEmail,
            ownerPasswordEnc: encPassword,
            chatwootUserId,
          }),
        },
      }),

      prisma.organization.update({
        where: { id: input.organizationId },
        data:  { chatwootAccountId },
      }),
    ])

    console.info(`[CHATWOOT PROVISION] ✅ Org ${input.orgSlug} → Account #${chatwootAccountId}`)

    return { success: true, chatwootAccountId, chatwootUserId }
  } catch (err) {
    console.error('[CHATWOOT PROVISION] Erro inesperado:', err)
    return { success: false, error: 'unexpected_error' }
  }
}