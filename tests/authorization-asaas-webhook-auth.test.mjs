import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextResponse } from 'next/server.js'
import { loadHandler } from './helpers/load-disposable-handler.mjs'
function route(secret) {
  let reads = 0
  const handler = loadHandler('src/app/api/webhooks/asaas/route.ts', {
    'next/server': { NextResponse },
    '@/lib/prisma': { prisma: new Proxy({}, { get: () => { reads++; throw new Error('Unexpected database access') } }) },
    '@/lib/checkLimits': { syncPlanLimits: () => { throw new Error('Unexpected commercial mutation') } },
  }, { process: { env: { ASAAS_WEBHOOK_TOKEN: secret } }, console: { log() {}, warn() {}, error() {} } }).POST
  return { handler, reads: () => reads }
}
const request = headers => new Request('http://localhost/api/webhooks/asaas', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ event: 'IGNORED_FIXTURE_EVENT' }) })
test('Asaas: missing server token fails closed before body/commercial access', async () => {
  for (const secret of [undefined, '']) {
    const r = route(secret)
    assert.equal((await r.handler(request({}))).status, 503)
    assert.equal(r.reads(), 0)
  }
})
test('Asaas: missing/incorrect client token denied before database or plan mutations', async () => {
  const r = route('fixture-webhook-token')
  for (const headers of [{}, { 'asaas-access-token': 'wrong' }, { 'x-webhook-token': 'fixture-webhook-token-extra' }]) assert.equal((await r.handler(request(headers))).status, 401)
  assert.equal(r.reads(), 0)
})
test('Asaas: both documented token headers retain compatibility without enabling billing', async () => {
  const r = route('fixture-webhook-token')
  for (const headers of [{ 'asaas-access-token': 'fixture-webhook-token' }, { 'x-webhook-token': 'fixture-webhook-token' }]) assert.equal((await r.handler(request(headers))).status, 200)
  assert.equal(r.reads(), 0)
})
