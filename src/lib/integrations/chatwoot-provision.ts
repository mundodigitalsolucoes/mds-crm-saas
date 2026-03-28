// src/lib/integrations/chatwoot-provision.ts
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

interface ProvisionInput {
  organizationId: string
  orgName: string
  orgSlug: string
  ownerUserId: string
  ownerName: string
  ownerEmail: string
  ownerPassword: string
}

interface ProvisionResult {
  success: boolean
  chatwootAccountId?: number
  chatwootUserId?: number
  error?: string
}

type StoredChatwootData = {
  chatwootUrl?: string
  chatwootAccountId?: number | string
  ownerEmail?: string
  ownerPasswordEnc?: string
  chatwootUserId?: number | string
}

function normalizeBaseUrl(url?: string | null) {
  return url?.trim().replace(/\/$/, '') || null
}

function toPositiveInt(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
  return num
}

function parseStoredChatwootData(raw: string): StoredChatwootData | null {
  try {
    const parsed = JSON.parse(raw) as StoredChatwootData
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function isReusableBinding(params: {
  orgDeletedAt: Date | null
  organizationChatwootAccountId: number | null
  connectedAccountIsActive: boolean
  connectedAccountData: StoredChatwootData | null
  ownerEmail: string
}) {
  const {
    orgDeletedAt,
    organizationChatwootAccountId,
    connectedAccountIsActive,
    connectedAccountData,
    ownerEmail,
  } = params

  if (orgDeletedAt) return false
  if (!connectedAccountIsActive) return false
  if (!connectedAccountData) return false

  const storedAccountId = toPositiveInt(connectedAccountData.chatwootAccountId)
  const storedUserId = toPositiveInt(connectedAccountData.chatwootUserId)
  const storedUrl = normalizeBaseUrl(connectedAccountData.chatwootUrl)
  const storedOwnerEmail = connectedAccountData.ownerEmail?.trim().toLowerCase()

  if (!storedAccountId || !storedUserId || !storedUrl || !storedOwnerEmail) {
    return false
  }

  if (storedOwnerEmail !== ownerEmail.trim().toLowerCase()) {
    return false
  }

  if (
    organizationChatwootAccountId &&
    organizationChatwootAccountId !== storedAccountId
  ) {
    return false
  }

  return true
}

/**
 * Confirma o usuário via endpoint SSO customizado.
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

/**
 * Provisiona account + usuário no Chatwoot via Platform API.
 * Requer CHATWOOT_PLATFORM_TOKEN (gerado em Super Admin → Aplicativos de plataforma).
 */
export async function provisionChatwootForOrg(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const chatwootUrl =
    normalizeBaseUrl(process.env.CHATWOOT_API_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_CHATWOOT_URL)

  const platformToken = process.env.CHATWOOT_PLATFORM_TOKEN

  if (!chatwootUrl) {
    console.warn('[CHATWOOT PROVISION] URL não configurada')
    return { success: false, error: 'super_admin_not_configured' }
  }

  if (!platformToken) {
    console.warn('[CHATWOOT PROVISION] CHATWOOT_PLATFORM_TOKEN não configurado')
    return { success: false, error: 'platform_token_not_configured' }
  }

  try {
    const existing = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: {
        id: true,
        slug: true,
        deletedAt: true,
        chatwootAccountId: true,
        chatwootUrl: true,
        connectedAccounts: {
          where: { provider: 'chatwoot' },
          select: {
            id: true,
            isActive: true,
            data: true,
            updatedAt: true,
          },
          take: 1,
        },
      },
    })

    if (!existing || existing.deletedAt) {
      console.warn('[CHATWOOT PROVISION] Organização inexistente ou inativa')
      return { success: false, error: 'organization_inactive' }
    }

    const currentBinding = existing.connectedAccounts[0] ?? null
    const currentData = currentBinding ? parseStoredChatwootData(currentBinding.data) : null

    const reusable = isReusableBinding({
      orgDeletedAt: existing.deletedAt,
      organizationChatwootAccountId: existing.chatwootAccountId ?? null,
      connectedAccountIsActive: currentBinding?.isActive ?? false,
      connectedAccountData: currentData,
      ownerEmail: input.ownerEmail,
    })

    if (reusable && currentData) {
      const currentAccountId = toPositiveInt(currentData.chatwootAccountId)
      const currentUserId = toPositiveInt(currentData.chatwootUserId)

      if (currentAccountId && currentUserId) {
        console.info(
          `[CHATWOOT PROVISION] Reutilizando vínculo consistente da org ${input.orgSlug} → Account #${currentAccountId}`
        )

        await prisma.organization.update({
          where: { id: input.organizationId },
          data: {
            chatwootAccountId: currentAccountId,
            chatwootUrl,
          },
        })

        return {
          success: true,
          chatwootAccountId: currentAccountId,
          chatwootUserId: currentUserId,
        }
      }
    }

    if (currentBinding) {
      console.warn(
        `[CHATWOOT PROVISION] Vínculo inconsistente detectado para org ${input.orgSlug}. ` +
        `Será reprovisionado com nova account própria.`
      )
    }

    // ── 1. Cria Account via Platform API ──────────────────────────────────
    const accountRes = await fetch(`${chatwootUrl}/platform/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': platformToken,
      },
      body: JSON.stringify({
        name: input.orgName,
        locale: 'pt_BR',
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!accountRes.ok) {
      const errText = await accountRes.text()
      console.warn('[CHATWOOT PROVISION] Falha criar account:', accountRes.status, errText)
      return { success: false, error: 'account_creation_failed' }
    }

    const accountJson = await accountRes.json()
    const chatwootAccountId = accountJson?.id as number

    if (!chatwootAccountId) {
      console.warn('[CHATWOOT PROVISION] Resposta inesperada ao criar account:', JSON.stringify(accountJson))
      return { success: false, error: 'account_creation_failed' }
    }

    console.info(`[CHATWOOT PROVISION] ✅ Account #${chatwootAccountId} criada`)

    // ── 2. Cria Usuário via Platform API ──────────────────────────────────
    const userRes = await fetch(`${chatwootUrl}/platform/api/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': platformToken,
      },
      body: JSON.stringify({
        name: input.ownerName,
        email: input.ownerEmail,
        password: input.ownerPassword,
        password_confirmation: input.ownerPassword,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!userRes.ok) {
      const errText = await userRes.text()
      console.warn('[CHATWOOT PROVISION] Falha criar usuário:', userRes.status, errText)
      return { success: false, error: 'user_creation_failed' }
    }

    const userJson = await userRes.json()
    const chatwootUserId = userJson?.id as number
    const accessToken = userJson?.access_token as string

    if (!chatwootUserId) {
      console.warn('[CHATWOOT PROVISION] Resposta inesperada ao criar usuário:', JSON.stringify(userJson))
      return { success: false, error: 'user_creation_failed' }
    }

    console.info(`[CHATWOOT PROVISION] ✅ Usuário #${chatwootUserId} criado`)

    // ── 3. Vincula usuário à account ──────────────────────────────────────
    const memberRes = await fetch(
      `${chatwootUrl}/platform/api/v1/accounts/${chatwootAccountId}/account_users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': platformToken,
        },
        body: JSON.stringify({
          user_id: chatwootUserId,
          role: 'administrator',
        }),
        signal: AbortSignal.timeout(15_000),
      }
    )

    if (!memberRes.ok) {
      const errText = await memberRes.text()
      console.warn('[CHATWOOT PROVISION] Falha vincular usuário à account:', memberRes.status, errText)
    } else {
      console.info(`[CHATWOOT PROVISION] ✅ Usuário #${chatwootUserId} vinculado à account #${chatwootAccountId}`)
    }

    // ── 4. Confirma usuário via SSO ───────────────────────────────────────
    await confirmChatwootUser(chatwootUrl, input.ownerEmail)

    // ── 5. Salva no banco do CRM ──────────────────────────────────────────
    const encToken = encryptToken(accessToken || '')
    const encPassword = encryptToken(input.ownerPassword)

    await prisma.$transaction([
      prisma.connectedAccount.upsert({
        where: {
          provider_organizationId: {
            provider: 'chatwoot',
            organizationId: input.organizationId,
          },
        },
        create: {
          provider: 'chatwoot',
          organizationId: input.organizationId,
          connectedById: input.ownerUserId,
          accessTokenEnc: encToken,
          isActive: true,
          data: JSON.stringify({
            chatwootUrl,
            chatwootAccountId,
            ownerEmail: input.ownerEmail,
            ownerPasswordEnc: encPassword,
            chatwootUserId,
          }),
        },
        update: {
          accessTokenEnc: encToken,
          isActive: true,
          lastError: null,
          lastSyncAt: new Date(),
          data: JSON.stringify({
            chatwootUrl,
            chatwootAccountId,
            ownerEmail: input.ownerEmail,
            ownerPasswordEnc: encPassword,
            chatwootUserId,
          }),
        },
      }),

      prisma.organization.update({
        where: { id: input.organizationId },
        data: {
          chatwootAccountId,
          chatwootUrl,
        },
      }),
    ])

    console.info(`[CHATWOOT PROVISION] ✅ Org ${input.orgSlug} → Account #${chatwootAccountId} provisionada com sucesso`)

    return { success: true, chatwootAccountId, chatwootUserId }
  } catch (err) {
    console.error('[CHATWOOT PROVISION] Erro inesperado:', err)
    return { success: false, error: 'unexpected_error' }
  }
}