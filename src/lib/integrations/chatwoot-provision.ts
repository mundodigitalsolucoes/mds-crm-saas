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

export async function provisionChatwootForOrg(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const chatwootUrl = process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '')
  const internalUrl = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl     = internalUrl ?? chatwootUrl

  if (!baseUrl) {
    console.info('[CHATWOOT PROVISION] URL não configurada — provisionamento manual necessário')
    return { success: false, error: 'super_admin_not_configured' }
  }

  try {
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
    const chatwootUserId    = data.id as number
    const accessToken       = data.access_token as string

    const publicUrl     = chatwootUrl ?? baseUrl
    const encToken      = encryptToken(accessToken)
    const encPassword   = encryptToken(input.ownerPassword) // salva para SSO

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
          }),
        },
      }),

      prisma.organization.update({
        where: { id: input.organizationId },
        data:  { chatwootAccountId },
      }),
    ])

    console.info(`[CHATWOOT PROVISION] ✅ Org ${input.orgSlug} → Account #${chatwootAccountId} criada`)

    return { success: true, chatwootAccountId, chatwootUserId }
  } catch (err) {
    console.error('[CHATWOOT PROVISION] Erro inesperado:', err)
    return { success: false, error: 'unexpected_error' }
  }
}