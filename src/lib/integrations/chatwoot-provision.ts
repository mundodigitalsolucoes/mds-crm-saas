// src/lib/integrations/chatwoot-provision.ts
import { randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/integrations/crypto'

interface ProvisionInput {
  organizationId: string
  orgName: string
  orgSlug: string
  ownerUserId: string
  ownerName: string
  ownerEmail: string
  ownerPassword?: string
  allowCreate?: boolean
  actorId?: string
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

function normalizeChatwootBaseUrl(url?: string | null): string | null {
  return normalizeBaseUrl(url)?.replace(/\/api\/v1$/i, '') || null
}

function toPositiveInt(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null
  return num
}

const CHATWOOT_WEBHOOK_SUBSCRIPTIONS = [
  'conversation_created',
  'conversation_status_changed',
  'conversation_updated',
  'message_created',
  'message_updated',
  'webwidget_triggered',
  'contact_created',
  'contact_updated',
  'conversation_typing_on',
  'conversation_typing_off',
] as const

type ChatwootWebhook = {
  id?: number
  url?: string
  webhook_url?: string
  subscriptions?: string[]
}

type ChatwootWebhooksResponse =
  | ChatwootWebhook[]
  | {
      payload?: unknown
      data?: unknown
      webhooks?: unknown
    }
  | null

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isChatwootWebhookArray(value: unknown): value is ChatwootWebhook[] {
  return Array.isArray(value) && value.every((item) => isRecord(item))
}

function normalizeChatwootWebhooksResponse(
  body: ChatwootWebhooksResponse
): ChatwootWebhook[] | null {
  if (isChatwootWebhookArray(body)) {
    return body
  }

  if (!isRecord(body)) {
    return null
  }

  const candidates = [
    body.payload,
    body.data,
    body.webhooks,
    isRecord(body.payload) ? body.payload.data : undefined,
    isRecord(body.payload) ? body.payload.webhooks : undefined,
    isRecord(body.data) ? body.data.payload : undefined,
    isRecord(body.data) ? body.data.webhooks : undefined,
    isRecord(body.webhooks) ? body.webhooks.payload : undefined,
    isRecord(body.webhooks) ? body.webhooks.data : undefined,
  ]

  return candidates.find(isChatwootWebhookArray) ?? null
}

function resolveCrmPublicUrl(): string | null {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.APP_URL) ||
    normalizeBaseUrl(process.env.NEXTAUTH_URL)
  )
}

function sanitizeChatwootError(text: string): string {
  return text
    .replace(/([?&]secret=)[^&\s"]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[^\s"]+/gi, '$1[REDACTED]')
    .replace(/(api_access_token["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[REDACTED]')
    .slice(0, 500)
}

async function readSanitizedResponse(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `HTTP ${res.status}`

  try {
    const json = JSON.parse(text) as {
      message?: string
      error?: string
      errors?: unknown
    }
    const message =
      json.message || json.error || JSON.stringify(json.errors ?? json)
    return sanitizeChatwootError(String(message))
  } catch {
    return sanitizeChatwootError(text)
  }
}

function getWebhookUrlWithoutSecret(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    parsed.searchParams.delete('secret')
    return parsed.toString()
  } catch {
    return null
  }
}

function webhookMatches(
  existingUrl: string | undefined,
  expectedWebhookUrl: string
): boolean {
  if (!existingUrl) return false

  const existingWithoutSecret = getWebhookUrlWithoutSecret(existingUrl)
  const expectedWithoutSecret = getWebhookUrlWithoutSecret(expectedWebhookUrl)

  return Boolean(
    existingWithoutSecret &&
    expectedWithoutSecret &&
    existingWithoutSecret === expectedWithoutSecret
  )
}

export async function ensureChatwootWebhookForAccount(params: {
  chatwootUrl: string
  accountApiToken: string
  chatwootAccountId: number
  creation: { attempted: boolean; expectedId?: number; beforeCreate: () => Promise<void> }
}): Promise<number> {
  const { chatwootUrl, accountApiToken, chatwootAccountId } = params
  const chatwootBaseUrl = normalizeChatwootBaseUrl(chatwootUrl)
  const crmPublicUrl = resolveCrmPublicUrl()
  const webhookSecret = process.env.CHATWOOT_WEBHOOK_SECRET?.trim()

  if (!chatwootBaseUrl) {
    throw new Error('chatwoot_url_not_configured')
  }

  if (!crmPublicUrl) {
    throw new Error('crm_public_url_not_configured')
  }

  if (!webhookSecret) {
    throw new Error('chatwoot_webhook_secret_not_configured')
  }

  const webhookUrl = new URL('/api/webhooks/chatwoot', crmPublicUrl)
  webhookUrl.searchParams.set('secret', webhookSecret)
  const webhookUrlWithSecret = webhookUrl.toString()
  const webhooksEndpoint = `${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/webhooks`
  const headers = {
    'Content-Type': 'application/json',
    api_access_token: accountApiToken,
  }

  // Absence is evidence only from a conclusive successful list. A durable
  // intent is written before POST; unknown outcomes must never be replayed.
  try {
    const listRes = await fetch(webhooksEndpoint, {
      method: 'GET', headers, redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!listRes.ok) { await readSanitizedResponse(listRes); throw Error('webhook_requires_review') }
    const webhooks = normalizeChatwootWebhooksResponse(await listRes.json())
    if (!webhooks || webhooks.some(w => !toPositiveInt(w.id) ||
      typeof (w.url ?? w.webhook_url) !== 'string' ||
      !getWebhookUrlWithoutSecret((w.url ?? w.webhook_url)!))) throw Error('webhook_requires_review')
    const matches = webhooks.filter(w => webhookMatches(w.url ?? w.webhook_url, webhookUrlWithSecret))
    if (matches.length > 1) throw Error('webhook_requires_review')
    if (matches.length === 1) {
      const id = toPositiveInt(matches[0].id)!
      if (params.creation.expectedId && params.creation.expectedId !== id) throw Error('webhook_requires_review')
      return id
    }
    if (params.creation.attempted || params.creation.expectedId) throw Error('webhook_requires_review')
    await params.creation.beforeCreate()
    const createRes = await fetch(webhooksEndpoint, {
      method: 'POST', headers, redirect: 'error',
      body: JSON.stringify({ name: 'MDS CRM', url: webhookUrlWithSecret, subscriptions: CHATWOOT_WEBHOOK_SUBSCRIPTIONS }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!createRes.ok) { await readSanitizedResponse(createRes); throw Error('webhook_requires_review') }
    const created: unknown = await createRes.json()
    if (!isRecord(created) || !toPositiveInt(created.id) ||
      typeof (created.url ?? created.webhook_url) !== 'string' ||
      !webhookMatches((created.url ?? created.webhook_url) as string, webhookUrlWithSecret)) throw Error('webhook_requires_review')
    return toPositiveInt(created.id)!
  } catch {
    // Never return upstream bodies, URLs or tokens to logs or the administrator.
    throw Error('webhook_requires_review')
  }
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

// Durable checkpoints live in the existing, tenant-unique ConnectedAccount.
// Pending external mutations are reconciled, never replayed as fresh creations.
type Phase = 'preflight' | 'account_creating' | 'account_ready' | 'user_creating' | 'user_ready' | 'membership' | 'webhook' | 'ready'
type WebhookProgress = { attempted: boolean; id?: number }
type Progress = { webhook?: WebhookProgress; version: 1; operationId: string; phase: Phase; runId?: string; leaseUntil?: string; error?: string }
type ProvisionData = StoredChatwootData & { ownerUserId?: string; provisioning?: Progress }
const safeError = (value: unknown) => typeof value === 'string' && /^[a-z_]{1,80}$/.test(value) ? value : 'provisioning_unavailable'
const failed = (error: string): ProvisionResult => ({ success: false, error })
function progressOf(data: ProvisionData | null): Progress | null {
  const p = data?.provisioning
  return p?.version === 1 && typeof p.operationId === 'string' && ['preflight','account_creating','account_ready','user_creating','user_ready','membership','webhook','ready'].includes(p.phase) ? p : null
}

/** A public administrative DTO, never credentials, raw data or upstream errors. */
export async function getChatwootProvisionStatus(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, deletedAt: true, chatwootAccountId: true, users: { where: { role: 'owner', deletedAt: null }, select: { id: true, email: true, chatwootUserId: true }, take: 2 } } })
  if (!org || org.deletedAt) return null
  const account = await prisma.connectedAccount.findUnique({ where: { provider_organizationId: { provider: 'chatwoot', organizationId } } })
  const data = account ? parseStoredChatwootData(account.data) as ProvisionData | null : null
  const p = progressOf(data), owner = org.users.length === 1 ? org.users[0] : null
  const ready = !!owner && owner.chatwootUserId === toPositiveInt(data?.chatwootUserId) && !!account?.isActive && !!account.accessTokenEnc && (!p || p.phase === 'ready') && !account.lastError && isReusableBinding({ orgDeletedAt: org.deletedAt, organizationChatwootAccountId: org.chatwootAccountId, connectedAccountIsActive: account.isActive, connectedAccountData: data, ownerEmail: owner.email }) && org.chatwootAccountId === toPositiveInt(data?.chatwootAccountId)
  const running = !!p?.runId && Date.parse(p.leaseUntil || '') > Date.now()
  return { orgId: organizationId, provisioned: ready, status: ready ? 'ready' : !owner ? 'awaiting_owner' : running ? 'provisioning' : account || org.chatwootAccountId ? 'recovery_required' : 'awaiting_provisioning',
    phase: p?.phase ?? null, chatwootAccountId: org.chatwootAccountId, lastSync: account?.lastSyncAt ?? null,
    lastError: account?.lastError ? safeError(account.lastError) : null,
    inspectionRequired: !ready && !p, recoveryAvailable: !!owner && !running }
}

/** Official Platform API provisioner used by signup and Super Admin. No Docker/Rails. */
export async function provisionChatwootForOrg(input: ProvisionInput): Promise<ProvisionResult> {
  const base = normalizeChatwootBaseUrl(process.env.CHATWOOT_API_URL) || normalizeChatwootBaseUrl(process.env.NEXT_PUBLIC_CHATWOOT_URL)
  const platformToken = process.env.CHATWOOT_PLATFORM_TOKEN
  if (!base) return failed('super_admin_not_configured')
  if (!platformToken) return failed('platform_token_not_configured')
  if (!process.env.CHATWOOT_WEBHOOK_SECRET?.trim() || !resolveCrmPublicUrl()) return failed('webhook_not_configured')
  // Detect encryption misconfiguration before creating a remote resource.
  try { encryptToken('synthetic-key-validation') } catch { return failed('encryption_not_configured') }
  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, include: { users: { where: { role: 'owner', deletedAt: null }, take: 2 } } })
  if (!org || org.deletedAt) return failed('organization_inactive')
  if (org.users.length !== 1 || org.users[0].id !== input.ownerUserId || org.users[0].email.toLowerCase() !== input.ownerEmail.trim().toLowerCase()) return failed('owner_requires_review')
  const owner = org.users[0]
  let binding = await prisma.connectedAccount.findUnique({ where: { provider_organizationId: { provider: 'chatwoot', organizationId: org.id } } })
  let data = binding ? parseStoredChatwootData(binding.data) as ProvisionData | null : null
  // A failed remote inspection is durable metadata, not permission to replace
  // an active integration. Recovery may clear it only after positive validation.
  const markBindingReview = async () => {
    if (binding?.isActive) {
      // A validation retry cannot reclassify or erase unrelated operational errors.
      if (binding.lastError && binding.lastError !== 'binding_requires_review') return failed('binding_requires_review')
      const changed = await prisma.connectedAccount.updateMany({ where: { id: binding.id, organizationId: org.id, isActive: true, data: binding.data, accessTokenEnc: binding.accessTokenEnc, updatedAt: binding.updatedAt }, data: { lastError: 'binding_requires_review' } })
      if (changed.count !== 1) return failed('concurrent_provisioning_change')
    }
    return failed('binding_requires_review')
  }
  if (org.chatwootUrl && normalizeChatwootBaseUrl(org.chatwootUrl) !== base) return markBindingReview()
  if (org.chatwootAccountId !== null && org.chatwootAccountId !== toPositiveInt(data?.chatwootAccountId) || owner.chatwootUserId !== null && owner.chatwootUserId !== toPositiveInt(data?.chatwootUserId)) return markBindingReview()
  const readRemote = async (path: string, token = platformToken): Promise<unknown> => {
    const res = await fetch(base + path, { headers: { api_access_token: token }, signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error' })
    if (!res.ok) throw Error('remote_inspection_unavailable')
    return res.json()
  }
  const record = (value: unknown): Record<string, unknown> => {
    if (!isRecord(value)) throw Error('platform_response_invalid')
    return value
  }
  const accountList = async () => {
    const body = await readRemote('/platform/api/v1/accounts')
    if (!Array.isArray(body) || !body.every(isRecord)) throw Error('remote_inspection_unavailable')
    return body
  }
  const assertLocalExclusive = async (accountId: number, userId?: number) => {
    const others = await prisma.organization.findFirst({ where: { id: { not: org.id }, chatwootAccountId: accountId }, select: { id: true } })
    if (others) throw Error('binding_requires_review')
    const connections = await prisma.connectedAccount.findMany({ where: { provider: 'chatwoot', organizationId: { not: org.id } }, select: { data: true } })
    if (connections.some(c => { const d = parseStoredChatwootData(c.data); return normalizeChatwootBaseUrl(d?.chatwootUrl) === base && (toPositiveInt(d?.chatwootAccountId) === accountId || userId && toPositiveInt(d?.chatwootUserId) === userId) })) throw Error('binding_requires_review')
    if (userId && await prisma.user.findFirst({ where: { organizationId: { not: org.id }, chatwootUserId: userId }, select: { id: true } })) throw Error('binding_requires_review')
  }
  const checkRemoteIdentity = async (accountId: number, userId: number, token: string) => {
    await assertLocalExclusive(accountId, userId)
    const remoteUser = record(await readRemote('/platform/api/v1/users/' + userId))
    if (toPositiveInt(remoteUser.id) !== userId || remoteUser.email !== owner.email || remoteUser.confirmed !== true) throw Error('identity_requires_review')
    if (progressOf(data) && (!isRecord(remoteUser.custom_attributes) || remoteUser.custom_attributes.crmUserId !== owner.id || remoteUser.custom_attributes.organizationId !== org.id || remoteUser.custom_attributes.crmProvisionOperationId !== data?.provisioning?.operationId)) throw Error('identity_requires_review')
    const profile = record(await readRemote('/api/v1/profile', token))
    if (toPositiveInt(profile.id) !== userId || profile.email !== owner.email || !Array.isArray(profile.accounts) || profile.accounts.length !== 1) throw Error('identity_requires_review')
    const membership = record(profile.accounts[0])
    if (toPositiveInt(membership.id) !== accountId || membership.role !== 'administrator') throw Error('membership_requires_review')
    const login = record(await readRemote('/platform/api/v1/users/' + userId + '/login'))
    if (typeof login.url !== 'string' || new URL(login.url, base).origin !== new URL(base).origin) throw Error('sso_unavailable')
  }
  // Never overwrite a live or unrecognized legacy integration, even with force=true.
  if (binding?.isActive) {
    if (!data || !isReusableBinding({ orgDeletedAt: org.deletedAt, organizationChatwootAccountId: org.chatwootAccountId, connectedAccountIsActive: true, connectedAccountData: data, ownerEmail: owner.email }) || org.chatwootAccountId !== toPositiveInt(data.chatwootAccountId) || normalizeChatwootBaseUrl(data.chatwootUrl) !== base || binding.lastError && binding.lastError !== 'binding_requires_review') return markBindingReview()
    try {
      await checkRemoteIdentity(toPositiveInt(data.chatwootAccountId)!, toPositiveInt(data.chatwootUserId)!, decryptToken(binding.accessTokenEnc))
      if (binding.lastError) {
        const cleared = await prisma.connectedAccount.updateMany({ where: { id: binding.id, organizationId: org.id, isActive: true, data: binding.data, accessTokenEnc: binding.accessTokenEnc, updatedAt: binding.updatedAt, lastError: 'binding_requires_review' }, data: { lastError: null, lastSyncAt: new Date() } })
        if (cleared.count !== 1) return failed('concurrent_provisioning_change')
      }
      return { success: true, chatwootAccountId: toPositiveInt(data.chatwootAccountId)!, chatwootUserId: toPositiveInt(data.chatwootUserId)! }
    } catch { return markBindingReview() }
  }
  if (binding && (!data || !progressOf(data) || data.ownerUserId !== owner.id || data.ownerEmail !== owner.email || normalizeChatwootBaseUrl(data.chatwootUrl) !== base)) return failed('binding_requires_review')
  if (!binding && (org.chatwootAccountId || !input.allowCreate)) return failed('inspection_required')
  const runId = randomUUID()
  if (!binding) {
    data = { chatwootUrl: base, ownerEmail: owner.email, ownerUserId: owner.id,
      ownerPasswordEnc: encryptToken('Cw@' + randomBytes(32).toString('base64url') + '!'),
      provisioning: { version: 1, operationId: randomUUID(), phase: 'preflight' } }
    try { binding = await prisma.connectedAccount.create({ data: { provider: 'chatwoot', organizationId: org.id, connectedById: owner.id, accessTokenEnc: '', isActive: false, data: JSON.stringify(data) } }) }
    catch (error) { return failed(error && typeof error === 'object' && 'code' in error && error.code === 'P2002' ? 'provisioning_in_progress' : 'provisioning_unavailable') }
  }
  data = parseStoredChatwootData(binding.data) as ProvisionData
  let progress = progressOf(data)!
  // Normalize legacy mutation evidence before membership recovery can change phase.
  if (progress.phase === 'webhook' && !progress.webhook) progress = { ...progress, webhook: { attempted: true } }
  if (progress.runId && Date.parse(progress.leaseUntil || '') > Date.now()) return failed('provisioning_in_progress')
  const save = async (next: ProvisionData, token = binding!.accessTokenEnc, failureOnly = false) => {
    const current = binding!
    const updated = await prisma.$transaction(async tx => {
      const live = await tx.user.findFirst({ where: { id: owner.id, organizationId: org.id, role: 'owner', email: owner.email, deletedAt: null, organization: { deletedAt: null } }, select: { id: true, chatwootUserId: true } })
      if (!failureOnly && !live) throw Error('organization_inactive')
      if (!failureOnly && live!.chatwootUserId !== owner.chatwootUserId) throw Error('owner_binding_requires_review')
      const changed = await tx.connectedAccount.updateMany({ where: { id: current.id, organizationId: org.id, isActive: false, data: current.data, accessTokenEnc: current.accessTokenEnc, updatedAt: current.updatedAt }, data: { data: JSON.stringify(next), accessTokenEnc: token, lastError: next.provisioning?.error ?? null } })
      if (changed.count !== 1) throw Error('concurrent_provisioning_change')
      return tx.connectedAccount.findUniqueOrThrow({ where: { id: current.id } })
    })
    binding = updated; data = next; progress = next.provisioning!
  }
  const checkpoint = async (phase: Phase, patch: Partial<ProvisionData> = {}, token?: string, webhook = progress.webhook) => save({ ...data!, ...patch, provisioning: { ...progress, webhook, phase, runId, leaseUntil: new Date(Date.now() + 120000).toISOString(), error: undefined } }, token)
  const post = async (path: string, body: unknown) => {
    const res = await fetch(base + '/platform/api/v1' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', api_access_token: platformToken }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!res.ok) throw Error('remote_creation_requires_review')
    return record(await res.json())
  }
  try {
    await checkpoint(progress.phase)
    let accountId = toPositiveInt(data.chatwootAccountId), userId = toPositiveInt(data.chatwootUserId)
    // Fresh preflight has no prior POST: keep the original direct-create contract.
    // A known ID is proved by its scoped GET below; global listing is optional.
    // Unknown POST outcomes still require conclusive reconciliation, never replay.
    const accounts = !accountId && progress.phase === 'preflight' ? []
      : accountId ? await accountList().catch(() => []) : await accountList()
    const marked = accounts.filter(a => isRecord(a.custom_attributes) && a.custom_attributes.crmOrganizationId === org.id && a.custom_attributes.crmProvisionOperationId === progress.operationId)
    if (marked.length > 1 || accountId && marked.length === 1 && toPositiveInt(marked[0].id) !== accountId) throw Error('account_requires_review')
    if (!accountId && marked.length === 1) { accountId = toPositiveInt(marked[0].id); if (!accountId) throw Error('platform_response_invalid'); await checkpoint('account_ready', { chatwootAccountId: accountId }) }
    if (!accountId) {
      if (progress.phase !== 'preflight' || marked.length || accounts.some(a => a.name === org.name && (!isRecord(a.custom_attributes) || typeof a.custom_attributes.crmOrganizationId !== 'string') || isRecord(a.custom_attributes) && a.custom_attributes.crmOrganizationId === org.id)) throw Error('account_requires_review')
      await checkpoint('account_creating')
      const account = await post('/accounts', { name: org.name, locale: 'pt_BR', custom_attributes: { crmOrganizationId: org.id, crmProvisionOperationId: progress.operationId } })
      accountId = toPositiveInt(account.id)
      if (!accountId) throw Error('account_requires_review')
      await checkpoint('account_ready', { chatwootAccountId: accountId })
      if (!isRecord(account.custom_attributes) || account.custom_attributes.crmOrganizationId !== org.id || account.custom_attributes.crmProvisionOperationId !== progress.operationId) throw Error('account_requires_review')
    } else {
      const remote = record(await readRemote('/platform/api/v1/accounts/' + accountId))
      if (!isRecord(remote.custom_attributes) || remote.custom_attributes.crmOrganizationId !== org.id || remote.custom_attributes.crmProvisionOperationId !== progress.operationId) throw Error('account_requires_review')
    }
    await assertLocalExclusive(accountId, userId ?? undefined)
    if (!userId) {
      if (progress.phase !== 'account_ready') throw Error('identity_requires_review')
      await checkpoint('user_creating')
      const user = await post('/users', { name: owner.name, email: owner.email, password: decryptToken(data.ownerPasswordEnc!), password_confirmation: decryptToken(data.ownerPasswordEnc!), custom_attributes: { crmUserId: owner.id, organizationId: org.id, crmProvisionOperationId: progress.operationId, source: 'mds-crm' } })
      userId = toPositiveInt(user.id)
      if (!userId || user.email !== owner.email || !isRecord(user.custom_attributes) || user.custom_attributes.crmUserId !== owner.id || user.custom_attributes.organizationId !== org.id || user.custom_attributes.crmProvisionOperationId !== progress.operationId || typeof user.access_token !== 'string' || !user.access_token) throw Error('identity_requires_review')
      if (Array.isArray(user.accounts) && user.accounts.some(a => !isRecord(a) || toPositiveInt(a.id) !== accountId)) throw Error('identity_requires_review')
      await checkpoint('user_ready', { chatwootUserId: userId }, encryptToken(user.access_token))
    }
    const token = decryptToken(binding.accessTokenEnc)
    const profile = record(await readRemote('/api/v1/profile', token))
    if (toPositiveInt(profile.id) !== userId || profile.email !== owner.email || !Array.isArray(profile.accounts)) throw Error('identity_requires_review')
    if (profile.accounts.some(a => !isRecord(a) || toPositiveInt(a.id) !== accountId)) throw Error('identity_requires_review')
    if (!profile.accounts.length) { await checkpoint('membership'); await post('/accounts/' + accountId + '/account_users', { user_id: userId, role: 'administrator' }) }
    await checkRemoteIdentity(accountId, userId, token)
    // Old phase=webhook checkpoints predate mutation intents and are ambiguous.
    const webhook = progress.webhook ?? { attempted: progress.phase === 'webhook' }
    await checkpoint('webhook', {}, undefined, webhook)
    const webhookId = await ensureChatwootWebhookForAccount({ chatwootUrl: base, accountApiToken: token, chatwootAccountId: accountId,
      creation: { attempted: webhook.attempted, expectedId: webhook.id, beforeCreate: () => checkpoint('webhook', {}, undefined, { attempted: true }) } })
    await checkpoint('webhook', {}, undefined, { attempted: true, id: webhookId })
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'chatwoot-account:' + accountId}, 0))`
      if (await tx.organization.findFirst({ where: { id: { not: org.id }, chatwootAccountId: accountId }, select: { id: true } })) throw Error('binding_requires_review')
      if (await tx.user.findFirst({ where: { organizationId: { not: org.id }, chatwootUserId: userId }, select: { id: true } })) throw Error('binding_requires_review')
      const user = await tx.user.updateMany({ where: { id: owner.id, organizationId: org.id, role: 'owner', email: owner.email, deletedAt: null, chatwootUserId: owner.chatwootUserId }, data: { chatwootUserId: userId, isChatwootAgent: true } })
      if (user.count !== 1) throw Error('owner_binding_requires_review')
      const organization = await tx.organization.updateMany({ where: { id: org.id, deletedAt: null, OR: [{ chatwootAccountId: null }, { chatwootAccountId: accountId }] }, data: { chatwootAccountId: accountId, chatwootUrl: base } })
      const ready = { ...data!, provisioning: { ...progress, phase: 'ready', runId: undefined, leaseUntil: undefined, error: undefined } }
      const connection = await tx.connectedAccount.updateMany({ where: { id: binding!.id, organizationId: org.id, isActive: false, data: binding!.data, accessTokenEnc: binding!.accessTokenEnc, updatedAt: binding!.updatedAt }, data: { data: JSON.stringify(ready), isActive: true, lastError: null, lastSyncAt: new Date() } })
      if (user.count !== 1 || organization.count !== 1 || connection.count !== 1) throw Error('concurrent_provisioning_change')
      await tx.activity.create({ data: { entityType: 'organization', entityId: org.id, action: 'updated', userId: null, description: 'Provisionamento Chatwoot concluído', metadata: JSON.stringify({ actorId: input.actorId ?? owner.id, accountId, userId, source: input.actorId ? 'superadmin' : 'signup' }) } })
    })
    return { success: true, chatwootAccountId: accountId, chatwootUserId: userId }
  } catch (error) {
    const code = safeError(error instanceof Error ? error.message : null)
    if (binding && !binding.isActive && progress.runId === runId) {
      try { await save({ ...data!, provisioning: { ...progress, runId: undefined, leaseUntil: undefined, error: code } }, binding.accessTokenEnc, true) } catch { /* Preserve the existing checkpoint when another actor changed it. */ }
    }
    return failed(code)
  }
}
