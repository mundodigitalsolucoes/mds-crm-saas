import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminPlanCreateSchema, adminPlanUpdateSchema } from '../src/lib/validations/admin';
import { parseChannelEntitlementContract } from '../src/lib/entitlements/channels';
import { loadServerModule } from './helpers/load-server-module';

test('legacy plan writes preserve -1, zero and positive WhatsApp limits without conversion', () => {
  for (const value of [-1, 0, 2]) {
    const created = adminPlanCreateSchema.parse({ name: 'custom', displayName: 'Custom', maxWhatsappInstances: value });
    const updated = adminPlanUpdateSchema.parse({ maxWhatsappInstances: String(value) });
    assert.equal(created.maxWhatsappInstances, value);
    assert.equal(updated.maxWhatsappInstances, value);
  }
  for (const value of [-2, 1.5]) {
    assert.equal(adminPlanUpdateSchema.safeParse({ maxWhatsappInstances: value }).success, false);
  }
});

test('future channel contract rejects -1; zero remains zero, not unlimited', () => {
  for (const value of [-1, 0, 2]) {
    const result = parseChannelEntitlementContract({
      version: 1, channels: { whatsapp: { allowed: true, maxConnections: value } }, addons: {},
    });
    assert.equal(result.success, value >= 0);
    if (result.success) assert.equal(result.data.channels.whatsapp?.maxConnections, value);
  }
});

test('documents the pre-existing operational guard: both -1 and zero currently bypass the legacy limit', async () => {
  let maxWhatsappInstances = -1;
  const prisma = { organization: { findUnique: async () => ({ plan: 'custom', maxWhatsappInstances }) } };
  const limits = loadServerModule<{
    checkWhatsappInstanceLimit: (id: string, current: number) => Promise<{ allowed: boolean }>;
  }>(new URL('../src/lib/checkLimits.ts', import.meta.url), { '@/lib/prisma': { prisma } });
  for (const value of [-1, 0]) {
    maxWhatsappInstances = value;
    assert.equal((await limits.checkWhatsappInstanceLimit('isolated-test-tenant', 100)).allowed, true);
  }
  maxWhatsappInstances = 2;
  assert.equal((await limits.checkWhatsappInstanceLimit('isolated-test-tenant', 2)).allowed, false);
});
