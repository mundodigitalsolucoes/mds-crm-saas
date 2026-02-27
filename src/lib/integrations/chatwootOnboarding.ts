/**
 * src/lib/integrations/chatwootOnboarding.ts
 *
 * Onboarding automático Chatwoot por org nova.
 * Executa Rails runner no container Chatwoot via docker exec para:
 *  1. Criar account isolado para a org
 *  2. Criar agente owner (administrator) com mesma senha do CRM
 *  3. Retornar accountId + access_token do agente
 *  4. Salvar ConnectedAccount no banco
 *
 * O token salvo permite auto-login no iframe sem o usuário digitar senha.
 */

import { execSync } from 'child_process'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'

const CHATWOOT_CONTAINER = process.env.CHATWOOT_CONTAINER_NAME ?? 'chatwoot-ss8c0sg0oss488owwss08ss0'
const CHATWOOT_PUBLIC_URL = process.env.CHATWOOT_API_URL?.replace(/\/$/, '') ?? ''

export interface ChatwootOnboardingResult {
  success:   boolean
  accountId?: number
  error?:    string
  skipped?:  boolean
}

/**
 * Gera senha válida para o Chatwoot.
 * Requisitos: 1 maiúscula, 1 especial, mínimo 8 chars.
 * Usa a senha do CRM como base, garantindo os requisitos.
 */
function buildChatwootPassword(crmPassword: string): string {
  // Se já tem maiúscula e especial, usa como está (até 72 chars)
  const hasUpper   = /[A-Z]/.test(crmPassword)
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|"\/\\.,`<>:;?~]/.test(crmPassword)
  if (hasUpper && hasSpecial) return crmPassword.slice(0, 72)
  // Caso contrário, adiciona prefixo garantido
  return `Mds@${crmPassword}`.slice(0, 72)
}

/**
 * Escapa string para uso seguro dentro de aspas simples Ruby.
 */
function rubyEscape(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Provisiona Chatwoot para uma organização nova via Rails runner.
 * Chamado no signup sem await (.catch() para não bloquear).
 */
export async function provisionChatwootForOrg(params: {
  organizationId: string
  orgName:        string
  ownerEmail:     string
  ownerName:      string
  ownerPassword:  string   // senha em plaintext do signup
  connectedById:  string
}): Promise<ChatwootOnboardingResult> {
  const { organizationId, orgName, ownerEmail, ownerName, ownerPassword, connectedById } = params

  console.log(`[ChatwootOnboarding] Provisionando Chatwoot para org: ${orgName}`)

  // ── Verifica se já existe ─────────────────────────────────────────────────
  const existing = await prisma.connectedAccount.findUnique({
    where: { provider_organizationId: { provider: 'chatwoot', organizationId } },
    select: { isActive: true },
  })
  if (existing?.isActive) {
    console.log(`[ChatwootOnboarding] Org ${organizationId} já tem Chatwoot — pulando.`)
    return { success: true, skipped: true }
  }

  // ── Monta o script Ruby ───────────────────────────────────────────────────
  const chatwootPassword = buildChatwootPassword(ownerPassword)

  const script = `
begin
  account = Account.create!(name: '${rubyEscape(orgName)}', locale: 'pt_BR')
  user = User.find_by(email: '${rubyEscape(ownerEmail)}')
  if user
    # Usuário já existe (conta 'teste' anterior) — adiciona ao account
    AccountUser.find_or_create_by!(account: account, user: user) { |au| au.role = :administrator }
  else
    user = User.create!(
      name:         '${rubyEscape(ownerName)}',
      email:        '${rubyEscape(ownerEmail)}',
      password:     '${rubyEscape(chatwootPassword)}',
      confirmed_at: Time.now
    )
    AccountUser.create!(account: account, user: user, role: :administrator)
  end
  token = user.access_token&.token || AccessToken.create!(owner: user).token
  puts "ACCOUNT_ID=#{account.id}"
  puts "USER_TOKEN=#{token}"
rescue => e
  puts "ERROR=#{e.message}"
end
`

  // ── Executa no container Chatwoot ─────────────────────────────────────────
  let accountId: number | null = null
  let userToken: string | null = null

  try {
    // Salva script em arquivo temporário no host e copia para o container
    const tmpFile  = `/tmp/cw_onboard_${organizationId.slice(0, 8)}.rb`
    const fs       = await import('fs')
    fs.writeFileSync(tmpFile, script, 'utf8')

    execSync(`docker cp ${tmpFile} ${CHATWOOT_CONTAINER}:${tmpFile}`, { timeout: 10_000 })
    fs.unlinkSync(tmpFile)

    const output = execSync(
      `docker exec ${CHATWOOT_CONTAINER} bundle exec rails runner ${tmpFile}`,
      { timeout: 60_000, encoding: 'utf8' }
    )

    for (const line of output.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('ACCOUNT_ID=')) accountId = parseInt(trimmed.split('=')[1], 10)
      if (trimmed.startsWith('USER_TOKEN=')) userToken = trimmed.split('=')[1]
      if (trimmed.startsWith('ERROR=')) {
        console.error('[ChatwootOnboarding] Erro no Rails:', trimmed)
        return { success: false, error: trimmed }
      }
    }

    if (!accountId || !userToken) {
      console.error('[ChatwootOnboarding] Output inesperado:', output)
      return { success: false, error: 'Output inesperado do Rails runner' }
    }

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[ChatwootOnboarding] Falha ao executar Rails runner:', error)
    return { success: false, error }
  }

  // ── Salva ConnectedAccount no banco ───────────────────────────────────────
  const data = JSON.stringify({
    chatwootUrl:       CHATWOOT_PUBLIC_URL,
    chatwootAccountId: accountId,
    provisionedAt:     new Date().toISOString(),
  })

  await prisma.connectedAccount.upsert({
    where:  { provider_organizationId: { provider: 'chatwoot', organizationId } },
    create: {
      provider:       'chatwoot',
      organizationId,
      connectedById,
      accessTokenEnc: encryptToken(userToken),
      isActive:       true,
      data,
    },
    update: {
      accessTokenEnc: encryptToken(userToken),
      isActive:       true,
      lastError:      null,
      lastSyncAt:     new Date(),
      data,
    },
  })

  console.log(`[ChatwootOnboarding] ✅ Chatwoot provisionado para "${orgName}" | accountId=${accountId}`)
  return { success: true, accountId }
}