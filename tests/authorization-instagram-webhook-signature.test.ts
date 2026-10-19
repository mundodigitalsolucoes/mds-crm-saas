import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('src/app/api/atendimento/instagram/webhook/route.ts', 'utf8')
const selectAccount = readFileSync('src/app/api/atendimento/instagram/select-account/route.ts', 'utf8')

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

test('Instagram account selection does not expose raw Meta provider errors', () => {
  assert.doesNotMatch(selectAccount, /details:\s*data\.error\?\.message\s*\|\|\s*data/)
  assert.match(selectAccount, /Erro ao validar conta selecionada na Meta/)
})

test('Instagram diagnostic routes never return raw Meta errors or access tokens', () => {
  for (const name of ['debug-token', 'debug-pages', 'subscribe-page']) {
    const source = readFileSync(`src/app/api/atendimento/instagram/${name}/route.ts`, 'utf8')
    assert.doesNotMatch(source, /details:\s*(?:data\.error\?\.message\s*\|\|\s*)?data\s*[,}]/)
  }
  const business = readFileSync('src/app/api/atendimento/instagram/debug-business-pages/route.ts', 'utf8')
  assert.doesNotMatch(business, /id,name,access_token/)
  assert.match(business, /meAccounts: safeResult\(meAccounts\)/)
  assert.match(business, /ownedPages: safeResult\(entry\.ownedPages\)/)
  assert.match(business, /clientPages: safeResult\(entry\.clientPages\)/)
})

test('Instagram settings cannot assert verified Meta identity or connected status', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/route.ts', 'utf8')
  assert.match(source, /facebookPageId: currentInstagram\.facebookPageId/)
  assert.match(source, /instagramBusinessId: currentInstagram\.instagramBusinessId/)
  assert.match(source, /status: currentInstagram\.status/)
})

test('Instagram accounts, sync and token exchange do not expose raw Meta errors', () => {
  for (const name of ['accounts', 'sync-account', 'exchange-token']) {
    const source = readFileSync(`src/app/api/atendimento/instagram/${name}/route.ts`, 'utf8')
    assert.doesNotMatch(source, /details:\s*(?:data\.error\?\.message\s*\|\|\s*)?data\s*[,}]/)
    assert.doesNotMatch(source, /details:\s*tokenData/)
  }
})

test('Instagram sync uses only the tenant-selected Facebook page', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/sync-account/route.ts', 'utf8')
  assert.doesNotMatch(source, /TARGET_FACEBOOK_PAGE_ID/)
  assert.match(source, /currentInstagram\.facebookPageId/)
  assert.match(source, /if \(!targetFacebookPageId\)/)
  assert.match(source, /page\.id === targetFacebookPageId/)
})

test('Instagram inbox requires verified Meta connection before provisioning', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(source, /currentInstagram\.status !== 'connected'/)
  assert.match(source, /currentInstagram\.facebookPageId/)
  assert.match(source, /currentInstagram\.metaAccessTokenEncrypted/)
  assert.match(source, /INSTAGRAM_META_CONNECTION_REQUIRED/)
})

test('Instagram settings response reflects persisted verified state', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/route.ts', 'utf8')
  assert.match(source, /const savedConfig = resolveInstagramConfigFromSettings\(nextSettings\)/)
  assert.match(source, /config: savedConfig/)
})

test('Instagram selection and sync require a page token before marking connected', () => {
  for (const name of ['select-account', 'sync-account']) {
    const source = readFileSync(`src/app/api/atendimento/instagram/${name}/route.ts`, 'utf8')
    assert.match(source, /\.access_token\?\.trim\(\)/)
    assert.match(source, /encryptToken\(.*\.access_token\)/)
  }
  const inbox = readFileSync('src/app/api/atendimento/instagram/create-inbox/route.ts', 'utf8')
  assert.match(inbox, /currentInstagram\.facebookPageAccessTokenEncrypted/)
})

test('Instagram OAuth callback does not reflect untrusted Meta errors in redirect', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/callback/route.ts', 'utf8')
  assert.doesNotMatch(source, /errorDescription\s*\|\|/)
  assert.doesNotMatch(source, /data\.error\?\.message\s*\|\|/)
  assert.doesNotMatch(source, /error\?\.message\s*\|\|/)
  assert.match(source, /Não foi possível concluir a conexão com a Meta/)
})

test('Instagram webhook excludes deleted tenants before resolving external business identifiers', () => {
  assert.match(route, /prisma\.organization\.findMany\(\{\s*where:\s*\{\s*deletedAt:\s*null\s*\}/)
  assert.match(route, /if \(matches\.length !== 1\) return null/)
});

test('Instagram webhook refuses disabled Chatwoot connections', () => {
  assert.match(route, /if \(!chatwootAccount\?\.isActive \|\| !chatwootAccount\.accessTokenEnc\) continue/)
  assert.ok(route.indexOf('!chatwootAccount?.isActive') < route.indexOf('decryptToken(chatwootAccount.accessTokenEnc)'))
})
