// src/lib/integrations/chatwoot-cleanup.ts
// Funções para limpar dados no Chatwoot quando orgs/usuários são deletados no CRM
// Usa a API HTTP do Chatwoot (Super Admin) em vez de SQL direto — evita problemas de rede Docker

const CHATWOOT_URL = process.env.CHATWOOT_API_URL?.replace(/\/$/, '') || 
                     process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '')
const SUPER_ADMIN_EMAIL    = process.env.CHATWOOT_SUPER_ADMIN_EMAIL
const SUPER_ADMIN_PASSWORD = process.env.CHATWOOT_SUPER_ADMIN_PASSWORD

/**
 * Faz login no Chatwoot como Super Admin e retorna o access token
 */
async function getSuperAdminToken(): Promise<string | null> {
  if (!CHATWOOT_URL || !SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.warn('[CHATWOOT CLEANUP] Credenciais super admin não configuradas')
    return null
  }

  try {
    const res = await fetch(`${CHATWOOT_URL}/auth/sign_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return null

    const json = await res.json()
    return json?.data?.access_token ?? null
  } catch (err) {
    console.warn('[CHATWOOT CLEANUP] Falha ao obter token super admin:', err)
    return null
  }
}

/**
 * Deleta uma Account inteira do Chatwoot via API.
 * O cascade do Chatwoot deleta automaticamente usuários e inboxes vinculados.
 */
export async function deleteChatwootAccount(chatwootAccountId: number): Promise<void> {
  if (!CHATWOOT_URL) {
    console.warn('[CHATWOOT CLEANUP] CHATWOOT_API_URL não configurado')
    return
  }

  try {
    const token = await getSuperAdminToken()
    if (!token) {
      console.warn('[CHATWOOT CLEANUP] Não foi possível obter token super admin')
      return
    }

    // Tenta via API de usuário autenticado (funciona para super admin)
    const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${chatwootAccountId}`, {
      method: 'DELETE',
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.ok || res.status === 404) {
      console.info(`[CHATWOOT CLEANUP] ✅ Account #${chatwootAccountId} deletada`)
    } else {
      const text = await res.text().catch(() => '')
      console.warn(`[CHATWOOT CLEANUP] Falha ao deletar account #${chatwootAccountId}: ${res.status} ${text}`)
    }
  } catch (err) {
    console.warn('[CHATWOOT CLEANUP] Erro ao deletar account:', err)
  }
}

/**
 * Deleta um usuário do Chatwoot via API (como agente de uma conta).
 * Para o owner da conta, usa deleteChatwootAccount em vez desta função.
 */
export async function deleteChatwootUser(chatwootUserId: number, chatwootAccountId?: number): Promise<void> {
  if (!CHATWOOT_URL) {
    console.warn('[CHATWOOT CLEANUP] CHATWOOT_API_URL não configurado')
    return
  }

  try {
    const token = await getSuperAdminToken()
    if (!token) {
      console.warn('[CHATWOOT CLEANUP] Não foi possível obter token super admin')
      return
    }

    // Se tem accountId, tenta deletar como agente da conta
    if (chatwootAccountId) {
      const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${chatwootAccountId}/agents/${chatwootUserId}`, {
        method: 'DELETE',
        headers: {
          'api_access_token': token,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok || res.status === 404) {
        console.info(`[CHATWOOT CLEANUP] ✅ Agente #${chatwootUserId} removido da conta #${chatwootAccountId}`)
        return
      }
    }

    // Fallback: se o usuário é owner, deleta a conta inteira (cascade)
    if (chatwootAccountId) {
      console.info(`[CHATWOOT CLEANUP] Usuário é owner — deletando conta #${chatwootAccountId} inteira`)
      await deleteChatwootAccount(chatwootAccountId)
    }
  } catch (err) {
    console.warn('[CHATWOOT CLEANUP] Erro ao deletar usuário:', err)
  }
}