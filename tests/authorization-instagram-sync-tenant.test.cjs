const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const source = readFileSync('src/app/api/atendimento/instagram/sync-account/route.ts', 'utf8')

test('Instagram sync uses session tenant and rejects deleted organizations', () => {
  assert.match(source, /checkPermission\(\s*'integrations',\s*'edit'\s*\)/)
  assert.match(source, /session!\.user\.organizationId|perm\.session\.user\.organizationId/)
  assert.match(source, /prisma\.organization\.findFirst\(/)
  assert.match(source, /where: \{ id: organizationId, deletedAt: null \}/)
})

test('Instagram sync refuses stale settings overwrites', () => {
  assert.match(source, /prisma\.organization\.updateMany\(/)
  assert.match(source, /settings: organization\.settings/)
  assert.match(source, /saved\.count !== 1/)
  assert.doesNotMatch(source, /prisma\.organization\.update\(/)
})
