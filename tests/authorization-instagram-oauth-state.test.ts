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
  assert.match(connect, /response\.cookies\.set\('mds_instagram_oauth_nonce'/);
  assert.match(callback, /timingSafeEqual\(receivedNonce, expectedNonce\)/);
  assert.match(callback, /maxAge: 0/);
  assert.match(callback, /session\.user\.organizationId !== state\.organizationId/);
  assert.ok(callback.indexOf('session.user.organizationId !== state.organizationId') < callback.indexOf('exchangeCodeForToken(code)'));
});

test('Instagram OAuth signed state rejects tampering, expiry and future timestamps', async () => {
  const { signInstagramState, verifyInstagramState } = await import('../src/lib/atendimento/instagram-oauth-state');
  const previous = process.env.NEXTAUTH_SECRET;
  const realNow = Date.now;
  try {
    process.env.NEXTAUTH_SECRET = 'isolated-authorization-test-secret';
    const start = 1_800_000_000_000;
    Date.now = () => start;
    const signed = signInstagramState({ organizationId: 'org-a', userId: 'user-a', nonce: 'a'.repeat(64) });
    assert.equal(verifyInstagramState(signed)?.organizationId, 'org-a');
    assert.equal(verifyInstagramState(signed)?.userId, 'user-a');
    assert.equal(verifyInstagramState(signed)?.nonce, 'a'.repeat(64));
    const [payload, signature] = signed.split('.');
    const altered = Buffer.from(JSON.stringify({ organizationId: 'org-b', userId: 'user-a', nonce: 'a'.repeat(64), source: 'mds_crm_instagram', issuedAt: start })).toString('base64url');
    assert.equal(verifyInstagramState(`${altered}.${signature}`), null);
    const badSignature = `${signature![0] === 'A' ? 'B' : 'A'}${signature!.slice(1)}`;
    assert.equal(verifyInstagramState(`${payload}.${badSignature}`), null);
    assert.equal(verifyInstagramState(payload), null);
    const otherNonce = signInstagramState({ organizationId: 'org-a', userId: 'user-a', nonce: 'b'.repeat(64) });
    assert.notEqual(verifyInstagramState(otherNonce)?.nonce, verifyInstagramState(signed)?.nonce);
    Date.now = () => start + 10 * 60 * 1000 + 1;
    assert.equal(verifyInstagramState(signed), null);
    Date.now = () => start - 31_000;
    assert.equal(verifyInstagramState(signed), null);
  } finally {
    Date.now = realNow;
    if (previous === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previous;
  }
});

test('Instagram OAuth callback revalidates live integration permission before token exchange', () => {
  assert.match(callback, /checkPermission\('integrations', 'edit'\)/);
  assert.match(callback, /!permission\.allowed/);
  assert.match(callback, /permission\.session\?\.user\.organizationId !== state\.organizationId/);
  assert.ok(callback.indexOf("checkPermission('integrations', 'edit')") < callback.indexOf('const token = await exchangeCodeForToken(code)'));
});
