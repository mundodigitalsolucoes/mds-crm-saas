import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseOrganization, readInventory, INVENTORY_READ_QUERY, type InventoryRow } from '../src/lib/authorization/inventory';

const base: InventoryRow = {
  id: 'fixture-id', plan: 'fixture-plan', planStatus: 'active', features: '["marketing"]',
  planFound: true, planFeatures: '["marketing"]',
};

test('inventory fixtures identify divergence without inferring entitlements from Plan.features', () => {
  const aligned = diagnoseOrganization(base);
  assert.equal(aligned.divergence, 'aligned'); assert.equal(aligned.requiresReview, false);
  const legacy = diagnoseOrganization({ ...base, features: '[]' });
  assert.equal(legacy.divergence, 'different'); assert.equal(legacy.requiresReview, true); assert.deepEqual(legacy.modules, []);
  assert.equal(diagnoseOrganization({ ...base, features: '{' }).divergence, 'not_comparable');
  assert.equal(diagnoseOrganization({ ...base, planFound: false }).divergence, 'plan_missing');
  assert.equal(diagnoseOrganization({ ...base, organizationDeleted: true }).requiresReview, true);
  assert.equal(diagnoseOrganization({ ...base, plan: 'trial', trialEndsAt: null }).requiresReview, true);
});

test('inventory output contains only pseudonymous refs and finite metadata, never raw unknown identifiers', () => {
  const result = diagnoseOrganization({ ...base, features: '["marketing","private-legacy-value"]', planStatus: 'private-status' });
  const serialized = JSON.stringify(result);
  for (const value of [base.id, base.plan, 'private-legacy-value', 'private-status']) assert.equal(serialized.includes(value), false);
  assert.equal(result.unknownFeatureCount, 1); assert.equal(result.requiresReview, true);
  assert.match(result.organizationRef, /^[a-f0-9]{64}$/);
});

test('inventory executes SELECT in a repeatable-read READ ONLY transaction and always rolls back', async () => {
  const statements: string[] = [];
  const result = await readInventory({ query: async (sql) => { statements.push(sql); return { rows: sql === INVENTORY_READ_QUERY ? [base] : [] }; } });
  assert.equal(result.length, 1);
  assert.equal(statements[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.some((sql) => /\b(INSERT|UPDATE|DELETE|COMMIT)\b/i.test(sql)), false);
});

test('inventory rolls back on read failure without modifying organizations', async () => {
  const statements: string[] = [];
  await assert.rejects(readInventory({ query: async (sql) => {
    statements.push(sql); if (sql === INVENTORY_READ_QUERY) throw new Error('read failure'); return { rows: [] };
  } }));
  assert.equal(statements.at(-1), 'ROLLBACK');
});
