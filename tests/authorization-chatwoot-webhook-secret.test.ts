import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Chatwoot webhook fails closed without configured secret', () => {
  const source = readFileSync('src/app/api/webhooks/chatwoot/route.ts', 'utf8');
  assert.match(source, /if \(!WEBHOOK_SECRET\) \{[\s\S]*?return false/);
  assert.match(source, /timingSafeEqual\(actual, expected\)/);
  assert.match(source, /if \(!validateSecret\(req\)\)/);
  assert.ok(source.indexOf('if (!validateSecret(req))') < source.indexOf('processChatwootEvent(payload, organizationId)'));
});

test('Chatwoot webhook retains mapped account to organization resolution', () => {
  const source = readFileSync('src/app/api/webhooks/chatwoot/route.ts', 'utf8');
  assert.match(source, /resolveOrganizationIdForChatwootAccount\(accountId\)/);
  assert.match(source, /if \(!organizationId\)/);
});
