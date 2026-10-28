import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server.js';
import * as validation from '../src/lib/validations/index.ts';
import * as features from '../src/lib/entitlements/features.ts';
import { disposableDatabaseUrl, loadHandler } from './helpers/load-disposable-handler.mjs';
let db;
const ids = [];
before(() => { db = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } }); });
after(async () => {
  if (!db) return;
  await db.activity.deleteMany({ where: { entityId: { in: ids } } });
  for (const id of ids) await db.organization.delete({ where: { id } });
  await db.$disconnect();
});
async function fixture() {
  const org = await db.organization.create({ data: { name: 'Governance fixture', slug: 'gov-' + randomUUID(), features: '["vendas","legacy_opaque"]' } });
  ids.push(org.id); return org;
}
function handler(prisma, actorId) {
  const forbidden = () => { throw Error('Unrelated operation invoked'); };
  return loadHandler('src/app/api/admin/organizations/[id]/route.ts', {
    'next/server': { NextResponse }, '@/lib/prisma': { prisma }, '@/lib/admin-auth': { verifyAdminToken: async () => ({ id: actorId }) },
    '@/lib/validations': validation, '@/lib/entitlements/features': features,
    '@/lib/checkLimits': { syncPlanLimits: forbidden }, '@/lib/integrations/chatwoot-cleanup': { hardCleanupChatwootAccount: forbidden },
    '@/lib/integrations/evolutionClient': { disconnectInstance: forbidden },
  }, { console: { error() {}, warn() {} } });
}
function request() { return new NextRequest('http://localhost/api/admin/organizations/fixture', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"whiteLabel":true}' }); }
test('White-Label uses a durable CAS: stale contract cannot overwrite concurrent modules', async () => {
  const org = await fixture();
  const prisma = { organization: db.organization, $transaction: async callback => {
    await db.organization.update({ where: { id: org.id }, data: { features: '["marketing"]' } });
    return db.$transaction(callback);
  } };
  const response = await handler(prisma, randomUUID()).PUT(request(), { params: Promise.resolve({ id: org.id }) });
  assert.equal(response.status, 409);
  assert.equal((await db.organization.findUnique({ where: { id: org.id } })).features, '["marketing"]');
  assert.equal(await db.activity.count({ where: { entityId: org.id } }), 0);
});
test('White-Label and audit are atomic: failed audit rolls back capability', async () => {
  const org = await fixture();
  const prisma = { organization: db.organization, $transaction: callback => db.$transaction(tx => callback({
    organization: tx.organization, activity: { create: async () => { throw Error('Simulated audit failure'); } },
  })) };
  const response = await handler(prisma, randomUUID()).PUT(request(), { params: Promise.resolve({ id: org.id }) });
  assert.equal(response.status, 500);
  assert.equal((await db.organization.findUnique({ where: { id: org.id } })).features, org.features);
  assert.equal(await db.activity.count({ where: { entityId: org.id } }), 0);
});
test('White-Label preserves modules and opaque legacy fields; audit has a separate admin actor', async () => {
  const org = await fixture(), actorId = randomUUID();
  const response = await handler(db, actorId).PUT(request(), { params: Promise.resolve({ id: org.id }) });
  assert.equal(response.status, 200);
  assert.equal((await db.organization.findUnique({ where: { id: org.id } })).features, '["vendas","legacy_opaque","white_label"]');
  const audit = await db.activity.findFirst({ where: { entityId: org.id } });
  assert.equal(audit.userId, null); assert.equal(JSON.parse(audit.metadata).actorId, actorId);
  await db.organization.update({ where: { id: org.id }, data: { deletedAt: new Date() } });
  assert.equal((await handler(db, actorId).PUT(request(), { params: Promise.resolve({ id: org.id }) })).status, 409);
});

function brandingRequest(id, branding = { name: 'Updated fixture', logo: '/images/logo-mds.svg', favicon: '/images/favicon.png', primaryColor: '#ffaa00', secondaryColor: '#123456' }) {
  return new NextRequest(`http://localhost/api/admin/organizations/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branding }) });
}
test('Super Admin identity edit preserves commercial fields and records audit atomically', async () => {
  const org = await fixture();
  await db.organization.update({ where: { id: org.id }, data: { features: '["vendas","white_label"]' } });
  const before = await db.organization.findUnique({ where: { id: org.id } });
  const response = await handler(db, randomUUID()).PUT(brandingRequest(org.id), { params: Promise.resolve({ id: org.id }) });
  assert.equal(response.status, 200);
  const after = await db.organization.findUnique({ where: { id: org.id } });
  for (const key of ['features', 'plan', 'maxUsers', 'maxLeads', 'chatwootAccountId', 'chatwootUrl']) assert.equal(after[key], before[key]);
  assert.equal(after.name, 'Updated fixture');
  assert.equal(await db.activity.count({ where: { entityId: org.id } }), 1);
  const failing = { organization: db.organization, $transaction: callback => db.$transaction(tx => callback({ organization: tx.organization, activity: { create: async () => { throw Error('Audit failed'); } } })) };
  const denied = await handler(failing, randomUUID()).PUT(brandingRequest(org.id, { name: 'Must rollback' }), { params: Promise.resolve({ id: org.id }) });
  assert.equal(denied.status, 500);
  assert.equal((await db.organization.findUnique({ where: { id: org.id } })).name, 'Updated fixture');
});
test('concurrent White-Label revocation or tenant deactivation prevents branding save with no partial audit', async () => {
  for (const data of [{ features: '["vendas"]' }, { deletedAt: new Date() }]) {
    const org = await fixture();
    await db.organization.update({ where: { id: org.id }, data: { features: '["vendas","white_label"]' } });
    const racing = { organization: db.organization, $transaction: async callback => {
      await db.organization.update({ where: { id: org.id }, data });
      return db.$transaction(callback);
    } };
    const response = await handler(racing, randomUUID()).PUT(brandingRequest(org.id), { params: Promise.resolve({ id: org.id }) });
    assert.equal(response.status, 409);
    assert.equal((await db.organization.findUnique({ where: { id: org.id } })).name, org.name);
    assert.equal(await db.activity.count({ where: { entityId: org.id } }), 0);
  }
});
