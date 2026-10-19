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

const selection = readFileSync('src/app/api/atendimento/instagram/select-account/route.ts', 'utf8')

test('Instagram selection scopes active tenant and prevents stale writes', () => {
  assert.match(selection, /checkPermission\(\s*'integrations',\s*'edit'\s*\)/)
  assert.match(selection, /session!\.user\.organizationId/)
  assert.match(selection, /prisma\.organization\.findFirst\(/)
  assert.match(selection, /where: \{ id: organizationId, deletedAt: null \}/)
  assert.match(selection, /prisma\.organization\.updateMany\(/)
  assert.match(selection, /settings: organization\.settings/)
  assert.match(selection, /saved\.count !== 1/)
})

const inbox = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')

test('Instagram inbox provisioning guards active tenant and both settings write paths', () => {
  assert.match(inbox, /checkPermission\('integrations', 'edit'\)/)
  assert.match(inbox, /perm\.session\.user\.organizationId/)
  assert.match(inbox, /prisma\.organization\.findFirst\(/)
  assert.match(inbox, /where: \{ id: organizationId, deletedAt: null \}/)
  assert.equal((inbox.match(/prisma\.organization\.updateMany\(/g) || []).length, 2)
  assert.equal((inbox.match(/settings: organization\.settings/g) || []).length, 2)
  assert.doesNotMatch(inbox, /prisma\.organization\.update\(/)
  assert.match(inbox, /saved\.count !== 1/)
})

const subscription = readFileSync('src/app/api/atendimento/instagram/subscribe-page/route.ts', 'utf8')

test('Instagram page subscription guards active tenant and stale settings', () => {
  assert.match(subscription, /checkPermission\(\s*'integrations',\s*'edit'\s*\)/)
  assert.match(subscription, /session!\.user\.organizationId/)
  assert.match(subscription, /prisma\.organization\.findFirst\(/)
  assert.match(subscription, /where: \{ id: organizationId, deletedAt: null \}/)
  assert.match(subscription, /prisma\.organization\.updateMany\(/)
  assert.match(subscription, /settings: organization\.settings/)
  assert.match(subscription, /saved\.count !== 1/)
  assert.doesNotMatch(subscription, /prisma\.organization\.update\(/)
})

const instagramSettings = readFileSync('src/app/api/atendimento/instagram/route.ts', 'utf8')

test('Instagram settings GET and POST use active tenant; POST prevents stale settings writes', () => {
  assert.match(instagramSettings, /checkPermission\(\s*'integrations',\s*'view'\s*\)/)
  assert.match(instagramSettings, /checkPermission\(\s*'integrations',\s*'edit'\s*\)/)
  assert.match(instagramSettings, /session!\.user\.organizationId/)
  assert.ok((instagramSettings.match(/prisma\.organization\.findFirst\(/g) || []).length >= 2)
  assert.match(instagramSettings, /where: \{ id: organizationId, deletedAt: null \}/)
  assert.match(instagramSettings, /prisma\.organization\.updateMany\(/)
  assert.match(instagramSettings, /settings: organization\.settings/)
  assert.match(instagramSettings, /saved\.count !== 1/)
  assert.doesNotMatch(instagramSettings, /prisma\.organization\.update\(/)
})
