// Source regression for the legacy Instagram token-exchange endpoint.
// This supplements (but does not replace) authenticated multi-tenant tests.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const route = readFileSync(join(__dirname, '../src/app/api/atendimento/instagram/exchange-token/route.ts'), 'utf8')

test('legacy Instagram token exchange binds body tenant to authenticated session', () => {
  assert.match(route, /checkPermission\('integrations', 'edit'\)/)
  assert.match(route, /const trustedOrganizationId = session!\.user\.organizationId/)
  assert.match(route, /organizationId !== trustedOrganizationId/)
})

test('legacy Instagram token exchange rejects deleted tenants before Meta network call', () => {
  assert.match(route, /prisma\.organization\.findFirst\(/)
  assert.match(route, /where: \{ id: trustedOrganizationId, deletedAt: null \}/)
  assert.ok(route.indexOf('prisma.organization.findFirst(') < route.indexOf('await fetch('))
})

test('legacy Instagram token exchange uses optimistic tenant-scoped settings update', () => {
  assert.match(route, /prisma\.organization\.updateMany\(/)
  assert.match(route, /settings: organization\.settings/)
  assert.match(route, /deletedAt: null/)
  assert.match(route, /saved\.count !== 1/)
  assert.doesNotMatch(route, /prisma\.organization\.update\(/)
})
