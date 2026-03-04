// src/lib/integrations/chatwoot-provision.ts
//
// Serviço de provisionamento automático de conta Chatwoot por organização.
//
// FLUXO:
//   1. Faz login como Super Admin no Chatwoot
//   2. Cria uma nova Account (isolada por org)
//   3. Cria o usuário owner como Administrator nessa account
//   4. Obtém o access_token do usuário
//   5. Salva ConnectedAccount no banco
//   6. Atualiza Organization.chatwootAccountId
//
// FALLBACK MANUAL: se CHATWOOT_SUPER_ADMIN_EMAIL não estiver configurado,
// o provisionamento é ignorado silenciosamente e o admin pode fazê-lo
// depois pelo Super Admin console do Chatwoot ou pela rota
// POST /api/admin/orgs/[orgId]/provision-chatwoot
//
// CONTENÇÃO: falha silenciosa — nunca bloqueia o signup do usuário.
// O CRM funciona 100% sem Chatwoot provisionado; a aba Atendimento
// simplesmente mostra "Configurar Integração".

import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

// ─── Tipos internos ─────────────────────────────────────────────────────────

interface ProvisionInput {
  organizationId: string
  orgName:        string
  orgSlug:        string
  ownerUserId:    string
  ownerName:      string
  ownerEmail:     string
  ownerPassword:  string   // senha em texto puro (apenas para criar no Chatwoot)
}

interface ProvisionResult {
  success:          boolean
  chatwootAccountId?: number
  chatwootUserId?:    number
  error?:           string
}

// Features mínimas habilitadas para o plano básico.
// Upsell de features adicionais é feito manualmente no Super Admin console.
const BASIC_FEATURES = [
  'agent_management',
  'team_management',
  'channel_whatsapp',   // via Evolution API
  'channel_instagram',
  'channel_facebook',
  'channel_email',
  'reports',
  'canned_responses',
]

// ─── Helper: autenticar como Super Admin ────────────────────────────────────

async function getSuperAdminToken(baseUrl: string): Promise<string | null> {
  const email    = process.env.CHATWOOT_SUPER_ADMIN_EMAIL
  const password = process.env.CHATWOOT_SUPER_ADMIN_PASSWORD

  if (!email || !password) return null

  try {
    const res = await fetch(`${baseUrl}/auth/sign_in`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
      signal:  AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.warn('[CHATWOOT PROVISION] Falha auth super admin:', res.status)
      return null
    }

    const json = await res.json()
    // Chatwoot retorna o token em data.access_token
    return json?.data?.access_token ?? null
  } catch (err) {
    console.error('[CHATWOOT PROVISION] Erro ao autenticar super admin:', err)
    return null
  }
}

// ─── Helper: criar Account no Chatwoot ──────────────────────────────────────

async function createChatwootAccount(
  baseUrl:    string,
  superToken: string,
  name:       string,
): Promise<{ id: number } | null> {
  try {
    const res = await fetch(`${baseUrl}/super_admin/api/v1/accounts`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        api_access_token: superToken,
      },
      body:   JSON.stringify({
        name,
        locale: 'pt_BR',
        // features habilitadas por padrão
        features: BASIC_FEATURES.reduce((acc, f) => ({ ...acc, [f]: true }), {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.warn('[CHATWOOT PROVISION] Falha criar account:', res.status, await res.text())
      return null
    }

    const json = await res.json()
    return { id: json.id }
  } catch (err) {
    console.error('[CHATWOOT PROVISION] Erro ao criar account:', err)
    return null
  }
}

// ─── Helper: criar usuário como Administrator na account ────────────────────

async function createChatwootAdminUser(
  baseUrl:    string,
  superToken: string,
  accountId:  number,
  params: {
    name:     string
    email:    string
    password: string
  },
): Promise<{ userId: number; accessToken: string } | null> {
  try {
    // Chatwoot Super Admin API: criar usuário e vinculá-lo à account
    const res = await fetch(`${baseUrl}/super_admin/api/v1/users`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        api_access_token: superToken,
      },
      body: JSON.stringify({
        name:                  params.name,
        email:                 params.email,
        password:              params.password,
        password_confirmation: params.password,
        role:                  'administrator',
        account_id:            accountId,
        availability:          'online',
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      // Email já em uso no Chatwoot — tenta buscar o usuário existente
      if (res.status === 422 && errText.includes('email')) {
        console.warn('[CHATWOOT PROVISION] Email já existe no Chatwoot, tentando vincular...')
        return await linkExistingUserToAccount(baseUrl, superToken, accountId, params.email)
      }
      console.warn('[CHATWOOT PROVISION] Falha criar usuário:', res.status, errText)
      return null
    }

    const json = await res.json()
    return {
      userId:      json.id,
      accessToken: json.access_token,
    }
  } catch (err) {
    console.error('[CHATWOOT PROVISION] Erro ao criar usuário:', err)
    return null
  }
}

// ─── Helper: vincular usuário existente à account ───────────────────────────

async function linkExistingUserToAccount(
  baseUrl:    string,
  superToken: string,
  accountId:  number,
  email:      string,
): Promise<{ userId: number; accessToken: string } | null> {
  try {
    // Buscar usuário pelo email via Super Admin
    const searchRes = await fetch(
      `${baseUrl}/super_admin/api/v1/users?q=${encodeURIComponent(email)}`,
      {
        headers: { api_access_token: superToken },
        signal:  AbortSignal.timeout(8_000),
      },
    )

    if (!searchRes.ok) return null
    const users = await searchRes.json()
    const user  = Array.isArray(users) ? users.find((u: any) => u.email === email) : null
    if (!user) return null

    // Criar AccountUser (vincula usuário à account como administrator)
    await fetch(`${baseUrl}/super_admin/api/v1/account_users`, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        api_access_token: superToken,
      },
      body: JSON.stringify({
        account_id: accountId,
        user_id:    user.id,
        role:       'administrator',
      }),
      signal: AbortSignal.timeout(8_000),
    })

    return {
      userId:      user.id,
      accessToken: user.access_token,
    }
  } catch {
    return null
  }
}

// ─── Função principal exportada ─────────────────────────────────────────────

export async function provisionChatwootForOrg(
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const chatwootUrl  = process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '')
  const internalUrl  = process.env.CHATWOOT_INTERNAL_URL?.replace(/\/$/, '')
  const baseUrl      = internalUrl ?? chatwootUrl

  // Se não houver URL ou credenciais super admin configuradas, skip silencioso
  if (!baseUrl || !process.env.CHATWOOT_SUPER_ADMIN_EMAIL) {
    console.info('[CHATWOOT PROVISION] Variáveis não configuradas — provisionamento manual necessário')
    return { success: false, error: 'super_admin_not_configured' }
  }

  try {
    // 1. Autenticar como Super Admin
    const superToken = await getSuperAdminToken(baseUrl)
    if (!superToken) {
      return { success: false, error: 'super_admin_auth_failed' }
    }

    // 2. Criar account isolada para esta org
    const account = await createChatwootAccount(baseUrl, superToken, input.orgName)
    if (!account) {
      return { success: false, error: 'account_creation_failed' }
    }

    // 3. Criar usuário administrator na account
    const adminUser = await createChatwootAdminUser(
      baseUrl,
      superToken,
      account.id,
      {
        name:     input.ownerName,
        email:    input.ownerEmail,
        password: input.ownerPassword,
      },
    )
    if (!adminUser) {
      return { success: false, error: 'user_creation_failed' }
    }

    // 4. Salvar ConnectedAccount + atualizar Organization (transação)
    const publicUrl = chatwootUrl ?? baseUrl
    const encToken  = encryptToken(adminUser.accessToken)

    await prisma.$transaction([
      // ConnectedAccount — mesmo padrão usado pelo connect/route.ts
      prisma.connectedAccount.upsert({
        where: {
          provider_organizationId: {
            provider:       'chatwoot',
            organizationId: input.organizationId,
          },
        },
        create: {
          provider:      'chatwoot',
          organizationId: input.organizationId,
          connectedById: input.ownerUserId,
          accessTokenEnc: encToken,
          isActive:      true,
          data: JSON.stringify({
            chatwootUrl:       publicUrl,
            chatwootAccountId: account.id,
          }),
        },
        update: {
          accessTokenEnc: encToken,
          isActive:       true,
          lastError:      null,
          lastSyncAt:     new Date(),
          data: JSON.stringify({
            chatwootUrl:       publicUrl,
            chatwootAccountId: account.id,
          }),
        },
      }),

      // Atualiza Organization com chatwootAccountId para lookups rápidos
      prisma.organization.update({
        where: { id: input.organizationId },
        data:  { chatwootAccountId: account.id },
      }),
    ])

    console.info(
      `[CHATWOOT PROVISION] ✅ Org ${input.orgSlug} → Account #${account.id} criada`,
    )

    return {
      success:          true,
      chatwootAccountId: account.id,
      chatwootUserId:   adminUser.userId,
    }
  } catch (err) {
    console.error('[CHATWOOT PROVISION] Erro inesperado:', err)
    return { success: false, error: 'unexpected_error' }
  }
}