// src/lib/integrations/chatwoot-cleanup.ts
// Funções para limpar dados no Chatwoot quando orgs/usuários são deletados no CRM
// Usa API HTTP (Super Admin) + SQL direto no Postgres do Chatwoot para invalidar sessões

import { Client } from 'pg'

const CHATWOOT_URL =
  process.env.CHATWOOT_API_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_CHATWOOT_URL?.replace(/\/$/, '')

const SUPER_ADMIN_EMAIL = process.env.CHATWOOT_SUPER_ADMIN_EMAIL
const SUPER_ADMIN_PASSWORD = process.env.CHATWOOT_SUPER_ADMIN_PASSWORD

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

// Conexão direta ao Postgres do Chatwoot (rede diferente — usa IP público)
function getChatwootDbClient(): Client {
  return new Client({
    host: process.env.CHATWOOT_DB_HOST || '145.223.94.75',
    port: Number(process.env.CHATWOOT_DB_PORT) || 5432,
    database: process.env.CHATWOOT_DB_NAME || 'chatwoot',
    user: process.env.CHATWOOT_DB_USER,
    password: process.env.CHATWOOT_DB_PASSWORD,
    connectionTimeoutMillis: 8000,
    ssl: false,
  })
}

// ─── Super Admin Token ────────────────────────────────────────────────────────

async function getSuperAdminToken(): Promise<string | null> {
  if (!CHATWOOT_URL || !SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.warn('[CHATWOOT CLEANUP] Credenciais super admin não configuradas')
    return null
  }

  try {
    const res = await fetch(`${CHATWOOT_URL}/auth/sign_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
      }),
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

// ─── Invalidar sessões via SQL ────────────────────────────────────────────────

/**
 * Invalida sessões de todos os usuários da conta no Chatwoot via SQL.
 * Rotaciona o access_token (UUID aleatório) — sessões ativas param de funcionar imediatamente.
 * Também desativa o usuário (confirmed_at = NULL, availability_status = 'offline').
 */
export async function invalidateChatwootUserSessions(
  chatwootAccountId: number
): Promise<{ blocked: string[]; errors: string[] }> {
  const blocked: string[] = []
  const errors: string[] = []

  const client = getChatwootDbClient()

  try {
    await client.connect()

    const { rows } = await client.query<{ email: string; id: number }>(
      `SELECT u.id, u.email
       FROM users u
       INNER JOIN account_users au ON au.user_id = u.id
       WHERE au.account_id = $1`,
      [chatwootAccountId]
    )

    if (rows.length === 0) {
      console.info(
        `[CHATWOOT CLEANUP] Nenhum usuário encontrado para account #${chatwootAccountId}`
      )
      return { blocked, errors }
    }

    const userIds = rows.map((r) => r.id)

    await client.query(
      `UPDATE users
       SET access_token        = gen_random_uuid()::text,
           availability_status = 'offline',
           confirmed_at        = NULL
       WHERE id = ANY($1)`,
      [userIds]
    )

    await client.query(`DELETE FROM account_users WHERE account_id = $1`, [
      chatwootAccountId,
    ])

    rows.forEach((r) => blocked.push(r.email))

    console.info(
      `[CHATWOOT CLEANUP] ✅ ${blocked.length} usuário(s) invalidados para account #${chatwootAccountId}:`,
      blocked
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CHATWOOT CLEANUP] Erro ao invalidar sessões via SQL:', msg)
    errors.push(`SQL error: ${msg}`)
  } finally {
    await client.end().catch(() => {})
  }

  return { blocked, errors }
}

/**
 * Contenção pontual de um agente por e-mail dentro de uma account específica.
 * Usado no delete de membro/owner individual sem derrubar a account inteira.
 */
export async function invalidateSingleChatwootUserSession(
  chatwootAccountId: number,
  email: string
): Promise<{
  found: boolean
  blocked: string[]
  errors: string[]
}> {
  const blocked: string[] = []
  const errors: string[] = []

  const client = getChatwootDbClient()

  try {
    await client.connect()

    const normalizedEmail = normalizeEmail(email)

    const { rows } = await client.query<{ id: number; email: string }>(
      `SELECT u.id, u.email
       FROM users u
       INNER JOIN account_users au ON au.user_id = u.id
       WHERE au.account_id = $1
         AND LOWER(u.email) = $2
       LIMIT 1`,
      [chatwootAccountId, normalizedEmail]
    )

    if (rows.length === 0) {
      console.info(
        `[CHATWOOT CLEANUP] Nenhum usuário Chatwoot encontrado para account #${chatwootAccountId} e email ${normalizedEmail}`
      )
      return { found: false, blocked, errors }
    }

    const target = rows[0]

    await client.query(
      `UPDATE users
       SET access_token        = gen_random_uuid()::text,
           availability_status = 'offline',
           confirmed_at        = NULL
       WHERE id = $1`,
      [target.id]
    )

    await client.query(
      `DELETE FROM account_users
       WHERE account_id = $1
         AND user_id = $2`,
      [chatwootAccountId, target.id]
    )

    blocked.push(target.email)

    console.info(
      `[CHATWOOT CLEANUP] ✅ Usuário ${target.email} contido/removido da account #${chatwootAccountId}`
    )

    return { found: true, blocked, errors }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      '[CHATWOOT CLEANUP] Erro ao invalidar usuário individual via SQL:',
      msg
    )
    errors.push(`SQL error: ${msg}`)
    return { found: false, blocked, errors }
  } finally {
    await client.end().catch(() => {})
  }
}

// ─── Deletar Account via API ──────────────────────────────────────────────────

/**
 * Tenta deletar a Account no Chatwoot via API super admin.
 * O Chatwoot tem bug conhecido que pode impedir a deleção — por isso
 * invalidateChatwootUserSessions() é chamado ANTES como contenção garantida.
 */
export async function deleteChatwootAccount(
  chatwootAccountId: number
): Promise<boolean> {
  if (!CHATWOOT_URL) {
    console.warn('[CHATWOOT CLEANUP] CHATWOOT_API_URL não configurado')
    return false
  }

  try {
    const token = await getSuperAdminToken()
    if (!token) {
      console.warn(
        '[CHATWOOT CLEANUP] Não foi possível obter token super admin'
      )
      return false
    }

    const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${chatwootAccountId}`, {
      method: 'DELETE',
      headers: {
        api_access_token: token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.ok || res.status === 404) {
      console.info(
        `[CHATWOOT CLEANUP] ✅ Account #${chatwootAccountId} deletada via API`
      )
      return true
    }

    const text = await res.text().catch(() => '')
    console.warn(
      `[CHATWOOT CLEANUP] API delete falhou #${chatwootAccountId}: ${res.status} ${text}`
    )
    return false
  } catch (err) {
    console.warn('[CHATWOOT CLEANUP] Erro ao deletar account via API:', err)
    return false
  }
}

// ─── Limpar orphans via SQL ───────────────────────────────────────────────────

/**
 * Remove dados orphan do Chatwoot via SQL quando a deleção via API falha.
 * Deleta: account_users, inboxes, conversations, contacts e a account em si.
 */
export async function purgeOrphanChatwootAccount(
  chatwootAccountId: number
): Promise<boolean> {
  const client = getChatwootDbClient()

  try {
    await client.connect()

    await client.query(`DELETE FROM conversations WHERE account_id = $1`, [
      chatwootAccountId,
    ])
    await client.query(`DELETE FROM contacts WHERE account_id = $1`, [
      chatwootAccountId,
    ])
    await client.query(`DELETE FROM inboxes WHERE account_id = $1`, [
      chatwootAccountId,
    ])
    await client.query(`DELETE FROM account_users WHERE account_id = $1`, [
      chatwootAccountId,
    ])
    await client.query(`DELETE FROM accounts WHERE id = $1`, [chatwootAccountId])

    console.info(
      `[CHATWOOT CLEANUP] ✅ Account #${chatwootAccountId} purgada via SQL`
    )
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CHATWOOT CLEANUP] Erro ao purgar account via SQL:', msg)
    return false
  } finally {
    await client.end().catch(() => {})
  }
}

/**
 * Hard cleanup da account da org:
 * 1. invalida sessões e remove vínculos
 * 2. tenta delete via API
 * 3. se falhar, tenta purge SQL
 */
export async function hardCleanupChatwootAccount(
  chatwootAccountId: number
): Promise<{
  contained: boolean
  blocked: string[]
  apiDeleted: boolean
  sqlPurged: boolean
  errors: string[]
}> {
  const errors: string[] = []

  const sessionResult = await invalidateChatwootUserSessions(chatwootAccountId)
  errors.push(...sessionResult.errors)

  const apiDeleted = await deleteChatwootAccount(chatwootAccountId)

  let sqlPurged = false
  if (!apiDeleted) {
    sqlPurged = await purgeOrphanChatwootAccount(chatwootAccountId)
    if (!sqlPurged) {
      errors.push(
        `Falha ao remover account #${chatwootAccountId} via API e também via SQL`
      )
    }
  }

  const contained =
    sessionResult.errors.length === 0 && (apiDeleted || sqlPurged || sessionResult.blocked.length > 0)

  return {
    contained,
    blocked: sessionResult.blocked,
    apiDeleted,
    sqlPurged,
    errors,
  }
}

// ─── Deletar agente individual ────────────────────────────────────────────────

/**
 * Remove um agente de uma conta específica no Chatwoot.
 * Não faz fallback destrutivo para deletar a account inteira.
 */
export async function deleteChatwootUser(
  chatwootUserId: number,
  chatwootAccountId?: number
): Promise<void> {
  if (!CHATWOOT_URL || !chatwootAccountId) return

  try {
    const token = await getSuperAdminToken()
    if (!token) return

    const res = await fetch(
      `${CHATWOOT_URL}/api/v1/accounts/${chatwootAccountId}/agents/${chatwootUserId}`,
      {
        method: 'DELETE',
        headers: {
          api_access_token: token,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (res.ok || res.status === 404) {
      console.info(
        `[CHATWOOT CLEANUP] ✅ Agente #${chatwootUserId} removido da conta #${chatwootAccountId}`
      )
      return
    }

    const text = await res.text().catch(() => '')
    console.warn(
      `[CHATWOOT CLEANUP] Falha ao remover agente #${chatwootUserId} da conta #${chatwootAccountId}: ${res.status} ${text}`
    )
  } catch (err) {
    console.warn('[CHATWOOT CLEANUP] Erro ao deletar usuário:', err)
  }
}