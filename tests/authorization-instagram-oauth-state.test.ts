import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const helper = readFileSync('src/lib/atendimento/instagram-oauth-state.ts', 'utf8');
const connect = readFileSync('src/app/api/atendimento/instagram/connect/route.ts', 'utf8');
const callback = readFileSync('src/app/api/atendimento/instagram/callback/route.ts', 'utf8');

test('Instagram OAuth state is signed, time-limited, and verified before token exchange', () => {
  assert.match(helper, /createHmac\('sha256', secret\(\)\)/);
  assert.match(helper, /timingSafeEqual\(received, expected\)/);
  assert.match(helper, /Date\.now\(\) - value\.issuedAt > MAX_AGE_MS/);
  assert.match(connect, /signInstagramState\(/);
  assert.match(callback, /verifyInstagramState\(rawState\)/);
  assert.match(callback, /session\.user\.id !== state\.userId/);
  assert.match(callback, /session\.user\.organizationId !== state\.organizationId/);
  assert.ok(callback.indexOf('session.user.organizationId !== state.organizationId') < callback.indexOf('exchangeCodeForToken(code)'));
});
