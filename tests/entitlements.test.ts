import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_CATALOG, featuresOfKind, isFeatureId } from '../src/lib/entitlements/catalog';
import { parseCommercialFeatures } from '../src/lib/entitlements/features';
import { parseChannelEntitlementContract } from '../src/lib/entitlements/channels';
import { createEntitlementResolver, resolveCommercialEntitlements } from '../src/lib/entitlements/resolver';

const resolve = (features: unknown, plan = 'custom') =>
  resolveCommercialEntitlements({ id: 'org-a', plan, features });

test('resolves Atendimento and Vendas without granting Marketing', () => {
  const result = resolve('["atendimento","vendas"]');
  assert.deepEqual(result.modules, ['atendimento', 'vendas']);
  assert.equal(result.module('marketing').contracted, false);
  assert.equal(result.module('vendas').contracted, true);
});

test('classifies White Label, capabilities, channels and addons independently', () => {
  const result = resolve('["white_label","advanced_reports","whatsapp","extra_user_addon"]');
  assert.deepEqual(result.capabilities, ['white_label', 'advanced_reports']);
  assert.deepEqual(result.channels, ['whatsapp']);
  assert.deepEqual(result.addons, ['extra_user_addon']);
  assert.equal(result.module('white_label').known, false);
  assert.equal(FEATURE_CATALOG.ai_assistant.kind, 'capability');
});

test('empty and missing features flag legacy review without universal access or enforcement', () => {
  for (const input of ['[]', null, undefined, '']) {
    const result = resolve(input, 'enterprise');
    assert.equal(result.compatibility.mode, 'observe_only');
    assert.equal(result.compatibility.enforcementEnabled, false);
    assert.equal(result.compatibility.needsMigrationReview, true);
    assert.deepEqual(result.modules, []);
    assert.equal(result.module('atendimento').contracted, false);
  }
});

test('invalid JSON and unexpected types fail in a controlled manner', () => {
  for (const raw of ['{', '{}', 'null', 'true', '42', '"vendas"', '["vendas",2]',
    '["vendas",null]', '[{}]', [], {}, 1, true]) {
    const parsed = parseCommercialFeatures(raw);
    assert.equal(parsed.status, 'invalid');
    assert.deepEqual(parsed.features, []);
    assert.equal(resolve(raw).module('vendas').contracted, false);
  }
});

test('unknown identifiers are diagnostics, never grants (including prototype names)', () => {
  const result = resolve('["vendas","new_module","__proto__","constructor"]');
  assert.deepEqual(result.parsed.unknown, ['new_module', '__proto__', 'constructor']);
  assert.deepEqual(result.modules, ['vendas']);
  assert.equal(result.module('new_module').known, false);
  assert.equal(result.module('constructor').contracted, false);
  assert.equal(isFeatureId('toString'), false);
  assert.equal(result.compatibility.needsMigrationReview, true);
});

test('normalizes duplicate identifiers without modifying casing or inventing aliases', () => {
  const result = parseCommercialFeatures('["vendas","vendas","vendas","future","future","Vendas"]');
  assert.deepEqual(result.features, ['vendas']);
  assert.deepEqual(result.duplicates, ['vendas', 'future']);
  assert.deepEqual(result.unknown, ['future', 'Vendas']);
});

test('legacy plan names do not grant implicit modules', () => {
  const result = resolve('["whatsapp","ai_assistant"]', 'professional');
  assert.deepEqual(result.modules, []);
  assert.deepEqual(result.capabilities, ['ai_assistant']);
  assert.ok(result.compatibility.reasons.includes('no_explicit_modules'));
  assert.equal(result.compatibility.enforcementEnabled, false);
});

test('future modules may be known and explicitly listed but are not available or contracted', () => {
  const result = resolve('["financeiro","agentes_ia"]');
  for (const id of ['financeiro', 'agentes_ia']) {
    assert.deepEqual(result.module(id), {
      known: true, available: false, explicitlyListed: true, contracted: false,
    });
  }
  assert.deepEqual(result.modules, []);
  assert.equal(featuresOfKind('module').length, 5);
});

test('tenant reads are exact, concurrent and never share entitlement snapshots', async () => {
  const requests: string[] = [];
  const read = createEntitlementResolver(async (id) => {
    requests.push(id);
    return { id, plan: 'same-plan', features: id === 'org-a' ? '["vendas"]' : '["marketing"]' };
  });
  const [a, b] = await Promise.all([read('org-a'), read('org-b')]);
  assert.ok(a.ok && b.ok);
  assert.equal(a.entitlements.organizationId, 'org-a');
  assert.equal(b.entitlements.organizationId, 'org-b');
  assert.equal(a.entitlements.module('marketing').contracted, false);
  assert.equal(b.entitlements.module('vendas').contracted, false);
  assert.deepEqual(requests, ['org-a', 'org-b']);
});

test('rejects mismatched tenant returned by a data adapter', async () => {
  const read = createEntitlementResolver(async () => ({ id: 'org-b', plan: 'enterprise', features: '["vendas"]' }));
  assert.deepEqual(await read('org-a'), { ok: false, organizationId: 'org-a', reason: 'tenant_mismatch' });
});

test('read failure, missing tenant and blank ID never yield unrestricted entitlements', async () => {
  const failure = createEntitlementResolver(async () => { throw new Error('private DB details'); });
  assert.deepEqual(await failure('org-a'), { ok: false, organizationId: 'org-a', reason: 'read_failed' });
  const missing = createEntitlementResolver(async () => null);
  assert.deepEqual(await missing('org-a'), { ok: false, organizationId: 'org-a', reason: 'not_found' });
  assert.deepEqual(await missing(' '), { ok: false, organizationId: ' ', reason: 'invalid_organization_id' });
});

test('resolver re-reads changes rather than retaining a stale plan or tenant cache', async () => {
  let features = '["vendas"]';
  const read = createEntitlementResolver(async (id) => ({ id, plan: 'custom', features }));
  const before = await read('org-a');
  features = '["marketing"]';
  const after = await read('org-a');
  assert.ok(before.ok && after.ok);
  assert.equal(before.entitlements.module('vendas').contracted, true);
  assert.equal(after.entitlements.module('vendas').contracted, false);
});

test('interprets the future channel contract including zero connections without provider calls', () => {
  const contract = {
    version: 1,
    channels: {
      whatsapp: { allowed: true, maxConnections: 2 },
      instagram_channel: { allowed: true, maxConnections: 1 },
      email_channel: { allowed: true, maxConnections: 1 },
      site_widget: { allowed: false, maxConnections: 0 },
    },
    addons: { extra_ai_addon: 100, extra_user_addon: 1 },
  };
  const result = parseChannelEntitlementContract(contract);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data, contract);
});

test('channel contracts reject unknown channels, modules, invalid quantities and contradictory allowance', () => {
  for (const channels of [
    { vendas: { allowed: true, maxConnections: 1 } },
    { unknown: { allowed: true, maxConnections: 1 } },
    { whatsapp: { allowed: false, maxConnections: 1 } },
    { whatsapp: { allowed: true, maxConnections: -1 } },
    { whatsapp: { allowed: true, maxConnections: 1.5 } },
    { whatsapp: { allowed: true, maxConnections: '2' } },
    { whatsapp: { allowed: true, maxConnections: Infinity } },
  ]) assert.equal(parseChannelEntitlementContract({ version: 1, channels, addons: {} }).success, false);
  assert.equal(parseChannelEntitlementContract({ version: 1, channels: {}, addons: { white_label: 1 } }).success, false);
  assert.equal(parseChannelEntitlementContract({ version: 2, channels: {}, addons: {} }).success, false);
});
