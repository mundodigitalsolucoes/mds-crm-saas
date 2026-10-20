const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes, randomUUID, createHmac } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const { NextRequest, NextResponse } = require('next/server')
const { disposableDatabaseUrl, loadHandler } = require('./helpers/load-disposable-handler.cjs')
let prisma, store, signer
const orgs = []
const appSecret = 'isolated-instagram-app-secret'
const authSecret = 'isolated-nextauth-secret-32-characters'
const env = { META_INSTAGRAM_APP_SECRET: appSecret, META_INSTAGRAM_APP_ID: 'fixture-app', NEXTAUTH_URL: 'http://localhost:3100', NEXTAUTH_SECRET: authSecret }
before(() => {
  prisma = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } })
  store = loadHandler('src/lib/atendimento/instagram-security-store.ts', { '@/lib/prisma': { prisma } })
  signer = loadHandler('src/lib/atendimento/instagram-oauth-state.ts', {}, { process: { env } })
})
after(async () => { if (prisma) { for (const id of orgs) await prisma.organization.delete({ where: { id } }); await prisma.$disconnect() } })
async function fixture() {
  const suffix = randomUUID()
  const businessId = `business-${suffix}`
  const org = await prisma.organization.create({ data: { name: 'Instagram isolated', slug: `instagram-${suffix}`, chatwootAccountId: 201, settings: JSON.stringify({ atendimentoInstagram: { instagramBusinessId: businessId, enabled: true, status: 'connected', chatwootInboxId: 202 } }) } })
  orgs.push(org.id)
  const user = await prisma.user.create({ data: { organizationId: org.id, name: 'Fixture', email: `${suffix}@example.invalid`, passwordHash: 'not-a-login-hash', role: 'owner' } })
  await prisma.connectedAccount.create({ data: { provider: 'chatwoot', organizationId: org.id, isActive: true, accessTokenEnc: 'fixture-encrypted', data: JSON.stringify({ chatwootAccountId: 201, chatwootUrl: 'https://chatwoot.example.invalid' }) } })
  return { org, user, businessId, nonce: randomBytes(32).toString('hex') }
}
const identity = f => ({ organizationId: f.org.id, userId: f.user.id, nonce: f.nonce })
function callback(f, remote, overrideStore = store, session = { user: { id: f.user.id, organizationId: f.org.id } }) {
  return loadHandler('src/app/api/atendimento/instagram/callback/route.ts', {
    'next/server': { NextResponse }, 'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} },
    '@/lib/checkPermission': { checkPermission: async () => ({ allowed: true, session }) },
    '@/lib/atendimento/instagram-oauth-state': signer, '@/lib/atendimento/instagram-security-store': overrideStore,
    '@/lib/prisma': { prisma }, '@/lib/integrations/crypto': { encryptToken: () => 'fixture-encrypted-token' },
  }, { fetch: remote, process: { env } }).GET
}
function callbackRequest(f, raw = signer.signInstagramState(identity(f))) {
  return new NextRequest(`http://localhost:3100/api/atendimento/instagram/callback?code=fixture-code&state=${encodeURIComponent(raw)}`, { headers: { cookie: `mds_instagram_oauth_nonce=${f.nonce}` } })
}
function webhook(remote, overrideStore = store, client = prisma) {
  return loadHandler('src/app/api/atendimento/instagram/webhook/route.ts', {
    'next/server': { NextResponse }, '@/lib/prisma': { prisma: client }, '@/lib/integrations/crypto': { decryptToken: () => 'fixture-token' }, '@/lib/atendimento/instagram-security-store': overrideStore,
  }, { fetch: remote, process: { env } }).POST
}
function delivery(f, mid = 'message-1', signature = true) {
  const body = JSON.stringify({ entry: [{ id: f.businessId, messaging: [{ sender: { id: 'sender-1' }, message: { text: 'Fixture message', ...(mid ? { mid } : {}) } }] }] })
  const digest = createHmac('sha256', signature ? appSecret : 'wrong-secret').update(body).digest('hex')
  return new NextRequest('http://localhost:3100/api/atendimento/instagram/webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${digest}` } })
}
function provider(counter) { return async (url) => { counter.calls++; return new Response(JSON.stringify({ id: url.endsWith('/contacts') ? 301 : 302 }), { status: 200 }) } }

test('G4 OAuth: hash only, one winner across eight concurrent consumers', async () => {
  const f = await fixture(); await store.persistInstagramOAuthState(identity(f))
  const row = await prisma.instagramOAuthState.findFirst({ where: { organizationId: f.org.id } })
  assert.notEqual(row.nonceHash, f.nonce)
  assert.equal(JSON.stringify(row).includes(f.nonce), false)
  const results = await Promise.all(Array.from({ length: 8 }, () => store.consumeInstagramOAuthState(identity(f))))
  assert.equal(results.filter(Boolean).length, 1)
})
test('G4 OAuth: wrong tenant/user, expiry and soft deletion fail closed', async () => {
  const f = await fixture(), other = await fixture(); await store.persistInstagramOAuthState(identity(f))
  assert.equal(await store.consumeInstagramOAuthState({ ...identity(f), organizationId: other.org.id }), false)
  assert.equal(await store.consumeInstagramOAuthState({ ...identity(f), userId: other.user.id }), false)
  await prisma.user.update({ where: { id: f.user.id }, data: { deletedAt: new Date() } })
  assert.equal(await store.consumeInstagramOAuthState(identity(f)), false)
  await prisma.user.update({ where: { id: f.user.id }, data: { deletedAt: null } })
  await prisma.instagramOAuthState.updateMany({ where: { organizationId: f.org.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  assert.equal(await store.consumeInstagramOAuthState(identity(f)), false)
})
test('G4 OAuth: issuance is bounded per user across concurrent requests', async () => {
  const f = await fixture()
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => store.persistInstagramOAuthState({ ...identity(f), nonce: randomBytes(32).toString('hex') })))
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 10)
  assert.equal(results.filter(x => x.status === 'rejected').length, 2)
})
test('G4 OAuth: simultaneous actual callbacks call Meta once; replay remains rejected', async () => {
  const f = await fixture(); await store.persistInstagramOAuthState(identity(f)); let calls = 0
  const get = callback(f, async () => { calls++; return new Response(JSON.stringify({ access_token: 'fixture-meta-token' })) })
  const raw = signer.signInstagramState(identity(f))
  const responses = await Promise.all([get(callbackRequest(f, raw)), get(callbackRequest(f, raw))])
  assert.equal(calls, 1)
  assert.equal(responses.filter(r => r.headers.get('location').includes('instagramCallback=success')).length, 1)
  await get(callbackRequest(f, raw)); assert.equal(calls, 1)
})
test('G4 OAuth: unavailable store and foreign session call no Meta', async () => {
  const f = await fixture(); await store.persistInstagramOAuthState(identity(f)); let calls = 0
  const remote = async () => { calls++; throw new Error('Must not dispatch') }
  const unavailable = callback(f, remote, { consumeInstagramOAuthState: async () => { throw new Error('storage offline') } })
  assert.match((await unavailable(callbackRequest(f))).headers.get('location'), /instagramCallback=error/)
  const foreign = callback(f, remote, store, { user: { id: randomUUID(), organizationId: f.org.id } })
  assert.match((await foreign(callbackRequest(f))).headers.get('location'), /instagramCallback=error/)
  assert.equal(calls, 0)
})
test('G4 webhook: bad signature, absent message identity and unavailable store dispatch nothing', async () => {
  const f = await fixture(); const count = { calls: 0 }; const post = webhook(provider(count))
  assert.equal((await post(delivery(f, 'signed-message', false))).status, 401)
  assert.equal((await post(delivery(f, null))).status, 400)
  const unavailable = webhook(provider(count), { ...store, claimInstagramMessage: async () => { throw new Error('storage offline') } })
  assert.equal((await unavailable(delivery(f))).status, 500)
  assert.equal(count.calls, 0)
})
test('G4 webhook: concurrent signed delivery sends one message, replay after new client sends none', async () => {
  const f = await fixture(); const count = { calls: 0 }; const post = webhook(provider(count))
  const responses = await Promise.all([post(delivery(f)), post(delivery(f))])
  assert.ok(responses.every(r => [200, 503].includes(r.status)))
  assert.equal(count.calls, 3, 'one contact, one conversation, one message')
  const second = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } })
  try {
    const secondStore = loadHandler('src/lib/atendimento/instagram-security-store.ts', { '@/lib/prisma': { prisma: second } })
    assert.equal((await webhook(provider(count), secondStore, second)(delivery(f))).status, 200)
    assert.equal(count.calls, 3)
  } finally { await second.$disconnect() }
})
test('G4 webhook: uncertain remote outcome retains durable receipt and blocks retry', async () => {
  const f = await fixture(); let calls = 0
  const post = webhook(async () => { calls++; throw new Error('remote timeout') })
  assert.equal((await post(delivery(f))).status, 500)
  assert.equal((await prisma.instagramWebhookReceipt.findFirst({ where: { organizationId: f.org.id } })).status, 'remote_unknown')
  assert.equal((await post(delivery(f))).status, 503)
  assert.equal(calls, 1)
})
test('G4 webhook: same message ID in different tenant bindings does not collide', async () => {
  const f = await fixture(), other = await fixture(); const count = { calls: 0 }; const post = webhook(provider(count))
  assert.equal((await post(delivery(f))).status, 200)
  assert.equal((await post(delivery(other))).status, 200)
  assert.equal(count.calls, 6)
})
