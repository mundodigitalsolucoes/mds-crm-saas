// src/lib/integrations/chatwoot-cleanup.ts
// Funções para limpar dados no Chatwoot quando orgs/usuários são deletados no CRM
import { Client } from 'pg'

/**
 * Deleta uma Account inteira do Chatwoot via SQL direto.
 * Usado quando uma organização é deletada no CRM.
 */
export async function deleteChatwootAccount(chatwootAccountId: number): Promise<void> {
  const dbUrl = process.env.CHATWOOT_DB_URL
  if (!dbUrl) {
    console.warn('[CHATWOOT CLEANUP] CHATWOOT_DB_URL não configurado — limpeza manual necessária')
    return
  }

  const client = new Client({ connectionString: dbUrl })
  try {
    await client.connect()
    await client.query('DELETE FROM accounts WHERE id = $1', [chatwootAccountId])
    console.info(`[CHATWOOT CLEANUP] ✅ Account #${chatwootAccountId} deletada`)
  } catch (err) {
    console.warn('[CHATWOOT CLEANUP] Aviso: falha ao deletar account:', err)
  } finally {
    await client.end()
  }
}

/**
 * Deleta um usuário do Chatwoot via SQL direto.
 * Usado quando um usuário (owner) é deletado no CRM.
 */
export async function deleteChatwootUser(chatwootUserId: number): Promise<void> {
  const dbUrl = process.env.CHATWOOT_DB_URL
  if (!dbUrl) {
    console.warn('[CHATWOOT CLEANUP] CHATWOOT_DB_URL não configurado — limpeza manual necessária')
    return
  }

  const client = new Client({ connectionString: dbUrl })
  try {
    await client.connect()
    await client.query('DELETE FROM users WHERE id = $1', [chatwootUserId])
    console.info(`[CHATWOOT CLEANUP] ✅ Usuário #${chatwootUserId} deletado`)
  } catch (err) {
    console.warn('[CHATWOOT CLEANUP] Aviso: falha ao deletar usuário:', err)
  } finally {
    await client.end()
  }
}