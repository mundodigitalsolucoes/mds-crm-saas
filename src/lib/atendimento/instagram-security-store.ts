import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const STATE_TTL_MS = 10 * 60 * 1000
function nonceHash(nonce: string) {
  if (!/^[a-f0-9]{64}$/.test(nonce)) throw new Error('INVALID_OAUTH_NONCE')
  return createHash('sha256').update(nonce).digest('hex')
}

type StateIdentity = { nonce: string; organizationId: string; userId: string }

export async function persistInstagramOAuthState(identity: StateIdentity) {
  const hash = nonceHash(identity.nonce)
  await prisma.$transaction(async (tx) => {
    // Bound active issuance per identity across instances. Expired states cannot
    // pass signature age checks, so scoped expiration cleanup cannot permit replay.
    const lockKey = `instagram-oauth:${identity.organizationId}:${identity.userId}`
    await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    const now = new Date()
    const scope = { organizationId: identity.organizationId, userId: identity.userId }
    const activeUser = await tx.user.findFirst({ where: { id: identity.userId, organizationId: identity.organizationId, deletedAt: null, organization: { deletedAt: null } }, select: { id: true } })
    if (!activeUser) throw new Error('OAUTH_IDENTITY_UNAVAILABLE')
    await tx.instagramOAuthState.deleteMany({ where: { ...scope, expiresAt: { lte: now } } })
    if (await tx.instagramOAuthState.count({ where: { ...scope, consumedAt: null } }) >= 10) {
      throw new Error('OAUTH_PENDING_LIMIT')
    }
    await tx.instagramOAuthState.create({ data: { ...scope, nonceHash: hash, expiresAt: new Date(now.getTime() + STATE_TTL_MS) } })
  })
}

export async function consumeInstagramOAuthState(identity: StateIdentity): Promise<boolean> {
  const result = await prisma.instagramOAuthState.updateMany({
    where: { nonceHash: nonceHash(identity.nonce), organizationId: identity.organizationId, userId: identity.userId, consumedAt: null, expiresAt: { gt: new Date() }, user: { organizationId: identity.organizationId, deletedAt: null }, organization: { deletedAt: null } },
    data: { consumedAt: new Date() },
  })
  return result.count === 1
}

export function instagramMessageHash(businessId: string, senderId: string, messageId: string) {
  if ([businessId, senderId, messageId].some(value => !value || value.length > 1024)) throw new Error('INVALID_INSTAGRAM_EVENT_ID')
  return createHash('sha256').update(JSON.stringify([businessId, senderId, messageId])).digest('hex')
}

type ReceiptIdentity = { organizationId: string; eventHash: string; chatwootAccountId: number; chatwootInboxId: number }

export async function claimInstagramMessage(identity: ReceiptIdentity): Promise<'claimed' | 'completed' | 'unresolved'> {
  const inserted = await prisma.instagramWebhookReceipt.createMany({ data: [identity], skipDuplicates: true })
  if (inserted.count === 1) return 'claimed'
  const existing = await prisma.instagramWebhookReceipt.findUnique({
    where: { organizationId_eventHash: { organizationId: identity.organizationId, eventHash: identity.eventHash } },
  })
  // A binding change is not permission to send the same event to a new account.
  return existing?.status === 'completed' && existing.chatwootAccountId === identity.chatwootAccountId && existing.chatwootInboxId === identity.chatwootInboxId ? 'completed' : 'unresolved'
}

export async function finishInstagramMessage(identity: ReceiptIdentity, status: 'completed' | 'remote_unknown') {
  const result = await prisma.instagramWebhookReceipt.updateMany({ where: { ...identity, status: 'pending' }, data: { status } })
  if (result.count !== 1) throw new Error('INSTAGRAM_RECEIPT_CONFLICT')
}
