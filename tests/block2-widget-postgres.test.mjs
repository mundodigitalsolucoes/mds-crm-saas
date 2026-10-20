// Actual Widget handlers + disposable PostgreSQL; provider/auth boundaries mocked.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server.js'
import { randomUUID } from 'node:crypto'
import * as zod from 'zod'
import { loadHandler } from './helpers/load-disposable-handler.mjs'
let prisma
const organizations = []
const calls = []
const config = { websiteInboxName: 'Same site name', websiteDomain: 'example.invalid', welcomeTitle: 'Hello', welcomeTagline: 'Local test', widgetColor: '#123456' }

before(() => {
  const url = new URL(process.env.BLOCK2_TEST_DATABASE_URL || 'http://invalid')
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'loopback DB only')
  assert.ok(['/mds_crm_dev', '/block2_ci'].includes(url.pathname), 'explicit disposable DB only')
  prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })
})
after(async () => {
  if (!prisma) return
  for (const id of organizations) await prisma.organization.delete({ where: { id } })
  await prisma.$disconnect()
})
async function fixture(accountId, runtime = {}) {
  const org = await prisma.organization.create({ data: { name: 'Widget fixture', slug: `widget-${randomUUID()}`, chatwootAccountId: accountId, settings: JSON.stringify({ atendimentoWidget: config, atendimentoWidgetRuntime: runtime }) } })
  organizations.push(org.id)
  await prisma.connectedAccount.create({ data: { organizationId: org.id, provider: 'chatwoot', accessTokenEnc: 'fixture-encrypted', data: JSON.stringify({ chatwootAccountId: accountId, chatwootUrl: 'https://chatwoot.example.invalid', chatwootUserId: 31 }), isActive: true } })
  return org
}
function handler(orgId, remote, route = 'provision', allowed = true) {
  const filename = `src/app/api/atendimento/widget/${route}/route.ts`
  const imports = {
    'next/server': { NextResponse }, zod,
    '@/lib/prisma': { prisma },
    '@/lib/checkPermission': { checkPermission: async () => ({ allowed, session: allowed ? { user: { organizationId: orgId } } : null, errorResponse: allowed ? null : NextResponse.json({ error: 'denied' }, { status: 403 }) }) },
    '@/lib/authorization/channel-observation': { observeChannelEntitlement: async () => undefined },
    '@/lib/integrations/crypto': { decryptToken: () => 'fixture-provider-token' },
  }
  return loadHandler(filename, imports, { fetch: async (url, options) => { calls.push({ orgId, url, method: options.method }); return remote(url, options) } }).POST
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
async function settings(id) { return JSON.parse((await prisma.organization.findUnique({ where: { id } })).settings) }

test('Widget: denied permission performs no provider call', async () => {
  const org = await fixture(101)
  let requests = 0
  const response = await handler(org.id, async () => { requests++; return json({}) }, 'provision', false)()
  assert.equal(response.status, 403)
  assert.equal(requests, 0)
})
test('Widget: two tenants with same inbox name use only their own Chatwoot account', async () => {
  for (const account of [102, 103]) {
    const org = await fixture(account)
    const response = await handler(org.id, async (url) => {
      assert.equal(url, `https://chatwoot.example.invalid/api/v1/accounts/${account}/inboxes`)
      return json({ id: account * 10, channel_id: account * 10 + 1, website_token: 'public-fixture' })
    })()
    assert.equal(response.status, 200)
    assert.equal((await settings(org.id)).atendimentoWidgetRuntime.chatwootInboxId, account * 10)
  }
})
test('Widget: competing real handlers send at most one creation POST', async () => {
  const org = await fixture(104)
  let posts = 0
  const post = handler(org.id, async (_, options) => { if (options.method === 'POST') posts++; return json({ id: 1040, channel_id: 1041 }) })
  const responses = await Promise.all([post(), post()])
  assert.equal(posts, 1)
  assert.ok(responses.every(response => [200, 409].includes(response.status)))
  assert.equal((await settings(org.id)).atendimentoWidgetRuntime.chatwootInboxId, 1040)
})
test('Widget: timeout after dispatch blocks blind retry durably', async () => {
  const org = await fixture(105)
  let posts = 0
  const post = handler(org.id, async () => { posts++; throw new Error('remote outcome unknown') })
  assert.equal((await post()).status, 500)
  assert.equal((await settings(org.id)).atendimentoWidgetRuntime.provisionStatus, 'reconciliation_required')
  assert.equal((await post()).status, 409)
  assert.equal(posts, 1)
})
test('Widget: missing registered remote inbox never triggers replacement POST', async () => {
  const org = await fixture(106, { chatwootInboxId: 1060 })
  const methods = []
  const response = await handler(org.id, async (_, options) => { methods.push(options.method); return json({}, 404) })()
  assert.equal(response.status, 409)
  assert.deepEqual(methods, ['PATCH'])
})
test('Widget: provider errors never expose raw JSON or text in responses or settings', async () => {
  for (const route of ['provision', 'agents']) for (const raw of [JSON.stringify({ error: 'fixture-private-token-LEAK' }), 'fixture-private-token-LEAK']) {
    const org = await fixture(107, route === 'agents' ? { chatwootInboxId: 1070 } : {})
    const response = await handler(org.id, async () => new Response(raw, { status: 502 }), route)()
    assert.equal(response.status, 502)
    assert.doesNotMatch(await response.text(), /fixture-private-token-LEAK/)
    assert.doesNotMatch(JSON.stringify(await settings(org.id)), /fixture-private-token-LEAK/)
  }
})
test('Widget: agent completion conflict preserves concurrent settings', async () => {
  const org = await fixture(108, { chatwootInboxId: 1080 })
  const response = await handler(org.id, async () => {
    await prisma.organization.update({ where: { id: org.id }, data: { settings: JSON.stringify({ concurrent: 'preserve' }) } })
    return json({ payload: [{ id: 31 }] })
  }, 'agents')()
  assert.equal(response.status, 409)
  assert.deepEqual(await settings(org.id), { concurrent: 'preserve' })
})
test('Widget: stale external settings writer must not permit duplicate inbox', { todo: 'BLOCKER: durable operation identity and remote reconciliation require an approved persistence design' }, async () => {
  const org = await fixture(109)
  let posts = 0
  const post = handler(org.id, async () => {
    posts++
    // Reproduce an existing unrelated writer that replaces the pre-reservation snapshot.
    await prisma.organization.update({ where: { id: org.id }, data: { settings: JSON.stringify({ atendimentoWidget: config, unrelated: 'preserve' }) } })
    return json({ id: 1090, channel_id: 1091 })
  })
  assert.equal((await post()).status, 409)
  assert.equal((await post()).status, 409)
  assert.equal(posts, 1, 'a remote success followed by lost CAS must never cause a second creation POST')
})
