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
  assert.equal((inbox.match(/prisma\.organization\.updateMany\(/g) || []).length, 3)
  assert.equal((inbox.match(/settings: organization\.settings/g) || []).length, 1)
  assert.equal((inbox.match(/settings: expectedSettings/g) || []).length, 2)
  assert.match(inbox, /reservation\.count !== 1/)
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

test('Instagram account and diagnostic reads reject deleted tenants before provider calls', () => {
  for (const route of ['accounts', 'debug-token', 'debug-pages', 'debug-business-pages']) {
    const source = readFileSync(`src/app/api/atendimento/instagram/${route}/route.ts`, 'utf8')
    assert.match(source, /checkPermission\(\s*'integrations',\s*'view'\s*\)/, route)
    assert.match(source, /session!\.user\.organizationId/, route)
    assert.match(source, /prisma\.organization\.findFirst\(/, route)
    assert.match(source, /where: \{ id: organizationId, deletedAt: null \}/, route)
    assert.doesNotMatch(source, /prisma\.organization\.findUnique\(/, route)
  }
})

test('Business Manager diagnostics validate user-supplied Graph path segments', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/debug-business-pages/route.ts', 'utf8')
  assert.match(source, /searchParams\.get\('businessId'\)/)
  assert.match(source, /\^\\d\{1,32\}\$/)
  assert.match(source, /Business ID inválido/)
})

test('Instagram page subscription never returns unfiltered Meta response data', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/subscribe-page/route.ts', 'utf8')
  assert.doesNotMatch(source, /meta:\s*data\s*[,}]/)
  assert.doesNotMatch(source, /const data = await response\.json\(/)
  assert.match(source, /if \(!response\.ok\)/)
})

test('Instagram inbox errors do not forward raw Chatwoot provider details', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(source, /error: error\.code/)
  assert.match(source, /message: error\.message/)
  assert.doesNotMatch(source, /detail: error\.detail/)
})

test('Instagram inbox provider errors are normalized without raw provider body persistence', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.doesNotMatch(source, /const detail =/)
  assert.doesNotMatch(source, /chatwoot_http_\$\{response\.status\}/)
  assert.match(source, /'CHATWOOT_INSTAGRAM_INBOX_REQUEST_FAILED'/)
  assert.match(source, /'Falha ao criar inbox API do Instagram no Atendimento\.',\s*502/)
})

test('Instagram inbox errors do not retain provider details', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.equal(source.includes('this.detail ='), false)
  assert.equal(source.includes('detail?: string'), false)
})

test('Instagram inbox identifiers reject unsafe integers', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(source, /Number\.isSafeInteger\(num\)/)
  assert.equal(source.includes('Number.isInteger(num)'), false)
})

test('Instagram inbox identifiers do not accept coercion or alternate numeric syntax', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.equal(source.includes("typeof value !== 'number' && typeof value !== 'string'"), true)
  assert.equal(source.includes(String.raw`/^[1-9]\d*$/`), true)
  assert.equal(source.includes('Number.isSafeInteger(num)'), true)
})

test('Malformed stored Instagram inbox references cannot trigger blind Chatwoot creation', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  const guard = source.indexOf("'CHATWOOT_INBOX_ID_INVALID'")
  const create = source.indexOf("method: 'POST'", guard)
  assert.ok(guard > 0)
  assert.ok(create > guard)
  assert.match(source, /rawExistingInboxId !== undefined/)
  assert.match(source, /!existingInboxId/)
})

test('Existing Instagram inbox cannot be updated under a different Chatwoot account', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  const mismatch = source.indexOf("'CHATWOOT_INBOX_ACCOUNT_MISMATCH'")
  const patch = source.indexOf("method: 'PATCH'", mismatch)
  assert.ok(mismatch > 0)
  assert.ok(patch > mismatch)
  assert.match(source, /toPositiveInt\(currentInstagram\.chatwootAccountId\) !== connectedAccountId/)
})

test('Instagram inbox PATCH response must match the stored inbox identifier', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(source, /existingInboxId && inboxId !== existingInboxId/)
  assert.match(source, /CHATWOOT_INBOX_RESPONSE_MISMATCH/)
  assert.ok(source.indexOf('CHATWOOT_INBOX_RESPONSE_MISMATCH') < source.indexOf('const nextSettings ='))
})

test('Malformed Chatwoot channel identifiers cannot be silently persisted', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(source, /rawChannelId !== undefined && rawChannelId !== null && !channelId/)
  assert.match(source, /CHATWOOT_CHANNEL_ID_INVALID/)
  assert.ok(source.indexOf('CHATWOOT_CHANNEL_ID_INVALID') < source.indexOf('const nextSettings ='))
})

test('Uncertain Chatwoot inbox creation requires reconciliation before another POST', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(source, /let remoteCreateAttempted = false/)
  assert.match(source, /remoteCreateAttempted = true/)
  assert.match(source, /\['reconciliation_required', 'pending'\]\.includes\(String\(currentInstagram\.inboxProvisionStatus\)\)/)
  assert.match(source, /CHATWOOT_INBOX_RECONCILIATION_REQUIRED/)
  assert.match(source, /remoteCreateAttempted \|\| \['reconciliation_required', 'pending'\]\.includes/)
  const guard = source.indexOf('CHATWOOT_INBOX_RECONCILIATION_REQUIRED')
  const createBranch = source.indexOf('remoteCreateAttempted = true', guard)
  const post = source.indexOf("method: 'POST'", createBranch)
  assert.ok(guard >= 0 && createBranch > guard && post > createBranch)
})

test('Malformed organization Chatwoot account references cannot bypass account isolation', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(source, /organization\.chatwootAccountId !== null/)
  assert.match(source, /organization\.chatwootAccountId !== undefined/)
  assert.match(source, /!organizationAccountId/)
  assert.match(source, /CHATWOOT_ORGANIZATION_ACCOUNT_ID_INVALID/)
  assert.ok(source.indexOf('CHATWOOT_ORGANIZATION_ACCOUNT_ID_INVALID') < source.indexOf('CHATWOOT_ACCOUNT_MISMATCH'))
})

test('Instagram inbox POST requires atomic tenant reservation and fail-closed pending state', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  const reservation = source.indexOf('const reservation = await prisma.organization.updateMany(')
  const post = source.indexOf("method: 'POST'", source.indexOf('remoteCreateAttempted = true'))
  assert.ok(reservation > 0 && post > reservation)
  assert.match(source, /inboxProvisionStatus: 'pending'/)
  assert.equal((source.match(/\['reconciliation_required', 'pending'\]\.includes/g) ?? []).length, 2)
  assert.match(source, /CHATWOOT_INBOX_RESERVATION_CONFLICT/)
  assert.match(source, /expectedSettings = pendingJson/)
  assert.match(source, /settings: expectedSettings/)
})

test('Instagram settings edits cannot invalidate pending or unresolved inbox reservation', () => {
  const settings = readFileSync('src/app/api/atendimento/instagram/route.ts', 'utf8')
  const pending = settings.indexOf("currentInstagram.inboxProvisionStatus === 'pending'")
  const unresolved = settings.indexOf("currentInstagram.inboxProvisionStatus === 'reconciliation_required'")
  const write = settings.indexOf('const saved = await prisma.organization.updateMany(')
  assert.ok(pending > 0 && unresolved > pending && write > unresolved)
  assert.match(settings.slice(pending, write), /status: 409/)
})

test('Instagram Meta selection, sync and subscription reject unresolved inbox reservation', () => {
  for (const route of ['select-account', 'sync-account', 'subscribe-page']) {
    const source = readFileSync(`src/app/api/atendimento/instagram/${route}/route.ts`, 'utf8')
    const guard = source.indexOf("['pending', 'reconciliation_required'].includes(String(currentInstagram.inboxProvisionStatus))")
    const write = source.indexOf('prisma.organization.updateMany(')
    assert.ok(guard > 0 && write > guard, `${route} must guard before persisting settings`)
    assert.match(source.slice(guard, write), /status: 409/)
  }
})

test('Instagram OAuth callback and token exchange cannot overwrite unresolved inbox reservation', () => {
  for (const route of ['callback', 'exchange-token']) {
    const source = readFileSync(`src/app/api/atendimento/instagram/${route}/route.ts`, 'utf8')
    const guard = source.indexOf("['pending', 'reconciliation_required'].includes(String(currentInstagram.inboxProvisionStatus))")
    const write = source.indexOf('prisma.organization.updateMany(')
    assert.ok(guard > 0 && write > guard, `${route} must reject unresolved inbox state before settings write`)
    assert.match(source.slice(guard, write), /Provisionamento da inbox pendente de reconciliação/)
  }
})

test('Widget settings save cannot overwrite an Instagram inbox reservation', () => {
  const source = readFileSync('src/app/api/atendimento/widget/route.ts', 'utf8')
  const write = source.indexOf('const saved = await prisma.organization.updateMany(')
  assert.ok(write > 0)
  assert.match(source.slice(write), /deletedAt: null, settings: organization\.settings/)
  assert.match(source.slice(write), /saved\.count !== 1/)
  assert.doesNotMatch(source.slice(write), /prisma\.organization\.update\(/)
})

test('Widget provision and agent-link completion/error paths preserve concurrent tenant settings', () => {
  for (const route of ['provision', 'agents']) {
    const source = readFileSync(`src/app/api/atendimento/widget/${route}/route.ts`, 'utf8')
    assert.equal((source.match(/prisma\.organization\.updateMany\(/g) ?? []).length, 2, `${route} must CAS both writes`)
    assert.doesNotMatch(source, /prisma\.organization\.update\(/)
    assert.match(source, /settings: params\.expectedSettings/)
    assert.match(source, /settings: organization\.settings/)
    assert.match(source, /saved\.count !== 1/)
    assert.match(source, /WIDGET_SETTINGS_CONFLICT/)
    assert.match(source, /expectedSettings: organization\.settings/)
    assert.equal((source.match(/deletedAt: null, settings:/g) ?? []).length, 2)
  }
})

test('Widget remote operations reject soft-deleted tenants before Chatwoot calls', () => {
  for (const route of ['provision', 'agents']) {
    const source = readFileSync(`src/app/api/atendimento/widget/${route}/route.ts`, 'utf8')
    assert.match(source, /prisma\.organization\.findFirst\(\{\s*where: \{ id: organizationId, deletedAt: null \}/)
    assert.doesNotMatch(source, /prisma\.organization\.findUnique\(/)
  }
})

test('Widget settings GET and POST require active tenants', () => {
  const source = readFileSync('src/app/api/atendimento/widget/route.ts', 'utf8')
  assert.equal((source.match(/prisma\.organization\.findFirst\(\{\s*where: \{ id: organizationId, deletedAt: null \}/g) ?? []).length, 3)
  assert.doesNotMatch(source, /prisma\.organization\.findUnique\(/)
})
