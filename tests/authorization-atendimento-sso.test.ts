import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectChatwootSsoUrl } from '../src/lib/integrations/chatwoot-sso-origin';

const source = readFileSync('src/app/api/integrations/chatwoot/credentials/route.ts', 'utf8');

test('Atendimento SSO credentials require the commercial module guard before any provider lookup', () => {
  const guard = "checkModulePermission({ module: 'atendimento', permission: 'atendimento', action: 'view' })";
  assert.ok(source.includes(guard), 'SSO credentials must consult Atendimento entitlement');
  assert.ok(source.indexOf(guard) < source.indexOf('prisma.organization.findUnique('), 'guard must run before DB/provider credentials');
  assert.ok(source.includes('if (!perm.allowed || !perm.session)'), 'denial must stop SSO credential issuance');
});

test('Atendimento SSO retains provider and tenant validation invariants', () => {
  for (const invariant of [
    'organization.deletedAt', 'account.organizationId !== organizationId',
    'orgChatwootAccountId !== connectedAccountId', 'getChatwootSsoUrl(',
  ]) {
    assert.ok(source.includes(invariant), `missing invariant: ${invariant}`);
  }
});

const apiOrigin = 'https://app.example.test';
const officialSso = `${apiOrigin}/app/login?email=synthetic%40example.test&sso_auth_token=synthetic-only`;
const ssoOrigins = JSON.stringify({ 'org-a': 'https://atendimento.customer.test' });

test('SSO mapping absent preserves the existing destination', () => {
  assert.equal(selectChatwootSsoUrl(officialSso, apiOrigin, 'org-a'), officialSso);
});
test('SSO mapping never applies another organization destination', () => {
  assert.equal(selectChatwootSsoUrl(officialSso, apiOrigin, 'org-b', ssoOrigins), officialSso);
});
test('SSO mapping changes only the approved origin, preserving the exact official query', () => {
  assert.equal(selectChatwootSsoUrl(officialSso, apiOrigin, 'org-a', ssoOrigins),
    'https://atendimento.customer.test/app/login?email=synthetic%40example.test&sso_auth_token=synthetic-only');
});
for (const mapping of ['bad-json', '[]', 'null', '42']) {
  test(`SSO rejects malformed server mapping: ${mapping}`, () => {
    assert.throws(() => selectChatwootSsoUrl(officialSso, apiOrigin, 'org-a', mapping));
  });
}
for (const target of ['http://evil.test', 'https://user:pass@evil.test', 'https://evil.test/path',
  'https://evil.test/?next=x', 'https://evil.test/#x', 'https://evil.test:8443', true]) {
  test(`SSO rejects invalid configured destination: ${String(target)}`, () => {
    assert.throws(() => selectChatwootSsoUrl(officialSso, apiOrigin, 'org-a', JSON.stringify({ 'org-a': target })));
  });
}
for (const [reason, source] of [
  ['foreign origin', officialSso.replace('app.example.test', 'evil.test')],
  ['wrong path', officialSso.replace('/app/login', '/redirect')],
  ['HTTP', officialSso.replace('https:', 'http:')],
  ['fragment', officialSso + '#fragment'],
  ['empty token', officialSso.replace('sso_auth_token=synthetic-only', 'sso_auth_token=')],
  ['empty email', officialSso.replace('email=synthetic%40example.test', 'email=')],
]) {
  test(`SSO rejects invalid official link: ${reason}`, () => {
    assert.throws(() => selectChatwootSsoUrl(source, apiOrigin, 'org-a', ssoOrigins));
  });
}
test('SSO prototype property is not an organization mapping', () => {
  assert.equal(selectChatwootSsoUrl(officialSso, apiOrigin, 'toString', ssoOrigins), officialSso);
});
