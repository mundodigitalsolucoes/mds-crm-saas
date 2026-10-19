import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('src/app/api/atendimento/instagram/webhook/route.ts', 'utf8')

test('Instagram webhook requires configured Meta secret and timing-safe HMAC over raw body before dispatch', () => {
  assert.match(route, /process\.env\.META_INSTAGRAM_APP_SECRET/)
  assert.match(route, /if \(!appSecret\).*status: 503/)
  assert.match(route, /req\.headers\.get\('x-hub-signature-256'\)/)
  assert.match(route, /createHmac\('sha256', appSecret\)\.update\(rawBody\)\.digest\(\)/)
  assert.match(route, /timingSafeEqual\(received, expected\)/)
  assert.ok(route.indexOf('timingSafeEqual(received, expected)') < route.indexOf('JSON.parse(rawBody)'))
  assert.ok(!route.includes('raw: JSON.stringify(body)'))
  assert.ok(!route.includes('senderId,\n          conversationId'))
  assert.ok(!route.includes("console.error('Erro webhook Instagram:', error)"))
})

test('Instagram webhook rejects ambiguous tenant mapping and inactive connections', () => {
  assert.match(route, /organizations\.filter\(/)
  assert.match(route, /instagram\.instagramBusinessId === instagramBusinessId/)
  assert.match(route, /instagram\.enabled === true && instagram\.status === 'connected'/)
  assert.match(route, /if \(matches\.length !== 1\) return null/)
  assert.match(route, /organizationId: organization\.id/)
})
