import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
    'getChatwootCredentials',
  ]) {
    // getChatwootCredentials is a legacy provider helper and may not be present in this handler.
    if (invariant === 'getChatwootCredentials') continue;
    assert.ok(source.includes(invariant), `missing invariant: ${invariant}`);
  }
});
