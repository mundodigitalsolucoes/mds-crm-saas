import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import * as validation from '../src/lib/validations';
import * as domainChange from '../src/lib/domains/commercial-change';
import * as featureValidation from '../src/lib/validations/plan-features';
import { resolveCommercialEntitlements } from '../src/lib/entitlements/resolver';
import { loadServerModule } from './helpers/load-server-module';

type PlanRecord = {
  id: string; name: string; displayName: string; price: number; features: string;
  maxUsers: number; maxLeads: number; maxProjects: number; maxOs: number; maxWhatsappInstances: number;
};
type Handlers = {
  POST: (request: NextRequest) => Promise<Response>;
  PUT: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  GET: () => Promise<Response>;
  DELETE: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
};

function fixture(features = '["vendas"]', role: string | null = 'superadmin') {
  let record: PlanRecord = {
    id: 'plan-1', name: 'custom', displayName: 'Custom', price: 50, features,
    maxUsers: 5, maxLeads: 100, maxProjects: 10, maxOs: 10, maxWhatsappInstances: -1,
  };
  const writes: { target: string; args: { data: Record<string, unknown>; where?: { plan?: string } } }[] = [];
  const prisma = {
    plan: {
      findUnique: async ({ where }: { where: { name?: string } }) => where.name ? null : record,
      findMany: async () => [record],
      create: async (args: { data: Record<string, unknown> }) => {
        writes.push({ target: 'plan.create', args });
        return { id: 'new-plan', ...args.data };
      },
      update: async (args: { data: Partial<PlanRecord> }) => {
        writes.push({ target: 'plan.update', args });
        record = { ...record, ...args.data };
        return record;
      },
      delete: async () => { throw new Error('Unexpected delete in plan regression'); },
    },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(prisma),
    organization: {
      findMany: async () => [1,2,3].map(id => ({ id: 'org-'+id, plan: 'custom', features, settings: '{}' })),
      count: async () => 3,
      updateMany: async (args: { data: Record<string, unknown>; where: { plan: string } }) => {
        writes.push({ target: 'organization.updateMany', args });
        return { count: 1 };
      },
    },
  };
  const imports = {
    '@/lib/prisma': { prisma },
    '@/lib/domains/commercial-change': domainChange,
    '@/lib/admin-auth': { verifyAdminToken: async () => role ? { role } : null },
    '@/lib/validations': validation,
    '@/lib/validations/plan-features': featureValidation,
  };
  const collection = loadServerModule<Handlers>(new URL('../src/app/api/admin/plans/route.ts', import.meta.url), imports);
  const item = loadServerModule<Handlers>(new URL('../src/app/api/admin/plans/[id]/route.ts', import.meta.url), imports);
  const request = (method: string, data: unknown) => new NextRequest('http://localhost/api/admin/plans/plan-1', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  return {
    writes, get: collection.GET,
    post: (data: unknown) => collection.POST(request('POST', data)),
    put: (data: unknown) => item.PUT(request('PUT', data), { params: Promise.resolve({ id: 'plan-1' }) }),
    rawPost: (body: string) => collection.POST(new NextRequest('http://localhost/api/admin/plans', { method: 'POST', body })),
    rawPut: (body: string) => item.PUT(new NextRequest('http://localhost/api/admin/plans/plan-1', { method: 'PUT', body }), {
      params: Promise.resolve({ id: 'plan-1' }),
    }),
    delete: () => item.DELETE(request('DELETE', {}), { params: Promise.resolve({ id: 'plan-1' }) }),
  };
}

const create = { name: 'custom', displayName: 'Custom' };

test('POST accepts available features, preserves the serialized payload and creates no tenant updates', async () => {
  const context = fixture();
  const features = '[ "atendimento", "vendas", "white_label", "vendas" ]';
  const response = await context.post({ ...create, features, maxWhatsappInstances: -1 });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).features, features);
  assert.deepEqual(context.writes.map((write) => write.target), ['plan.create']);
});

test('POST omitted features defaults to a valid empty list; POST [] remains accepted', async () => {
  for (const payload of [create, { ...create, features: '[]' }]) {
    const context = fixture();
    const response = await context.post(payload);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).features, '[]');
  }
});

for (const features of ['', ' ', '{', '{}', 'null', '1', '"vendas"', '["vendas",null]', '["vendas",2]', [], null]) {
  test(`POST/PUT reject malformed features ${JSON.stringify(features)} before any write`, async () => {
    const context = fixture();
    assert.equal((await context.post({ ...create, features })).status, 400);
    const response = await context.put({ features });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).details.features);
    assert.equal(context.writes.length, 0);
  });
}

test('POST and PUT reject new unknown and planned identifiers using the central catalog', async () => {
  for (const id of ['unknown_extension', 'financeiro', 'agentes_ia', '__proto__']) {
    const context = fixture();
    const features = JSON.stringify(['vendas', id]);
    assert.equal((await context.post({ ...create, features })).status, 400);
    assert.equal((await context.put({ features })).status, 400);
    assert.equal(context.writes.length, 0);
  }
});

test('PUT retains valid legacy unknown identifiers exactly, without granting rights', async () => {
  const features = '[ "vendas", "old_extension", "old_extension", "financeiro" ]';
  const context = fixture(features);
  const response = await context.put({ price: 65, features });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).features, features);
  assert.deepEqual(context.writes.map((write) => write.target), ['plan.update']);
  const resolved = resolveCommercialEntitlements({ id: 'tenant-1', plan: 'custom', features });
  assert.equal(resolved.module('old_extension').contracted, false);
  assert.equal(resolved.module('financeiro').contracted, false);
});

test('PUT allows editing known features while retaining legacy unknowns; new unknowns still fail', async () => {
  const context = fixture('["vendas","old_extension"]');
  assert.equal((await context.put({ features: '["atendimento","old_extension"]' })).status, 200);
  const before = context.writes.length;
  assert.equal((await context.put({ features: '["atendimento","old_extension","new_extension"]' })).status, 400);
  assert.equal(context.writes.length, before);
});

test('PUT can explicitly remove a legacy identifier; it is not silently reinserted', async () => {
  const context = fixture('["vendas","old_extension"]');
  const response = await context.put({ features: '["vendas"]' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).features, '["vendas"]');
});

test('PUT price/description/status only preserves malformed, missing or unknown legacy features', async () => {
  for (const features of ['{', '', '{}', '["vendas","old_extension"]']) {
    for (const payload of [{ price: 75 }, { description: 'Descrição atualizada' }, { isActive: false }]) {
      const context = fixture(features);
      const response = await context.put(payload);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).features, features);
      assert.equal('features' in context.writes[0].args.data, false);
      assert.deepEqual(context.writes.map((write) => write.target), ['plan.update']);
    }
  }
});

test('PUT can repair malformed features with a known valid list, without retaining corrupt data', async () => {
  const context = fixture('["vendas",2]');
  const response = await context.put({ features: '["atendimento"]' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).features, '["atendimento"]');
});

test('PUT propagation is opt-in for omitted/false and rejects truthy strings', async () => {
  for (const payload of [{ price: 65 }, { price: 65, propagateToOrgs: false }]) {
    const context = fixture();
    const response = await context.put(payload);
    assert.equal(response.status, 200);
    assert.equal((await response.json())._propagated, undefined);
    assert.deepEqual(context.writes.map((write) => write.target), ['plan.update']);
  }
  const context = fixture();
  assert.equal((await context.put({ price: 65, propagateToOrgs: 'true' })).status, 400);
  assert.equal(context.writes.length, 0);
});

test('PUT explicit propagation targets the old plan name and preserves -1 and legacy identifiers', async () => {
  const features = '["vendas","old_extension"]';
  const context = fixture(features);
  const response = await context.put({ name: 'renamed', propagateToOrgs: true, maxWhatsappInstances: -1 });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result._propagatedCount, 3);
  assert.deepEqual(context.writes.map((write) => write.target), ['plan.update', 'organization.updateMany', 'organization.updateMany', 'organization.updateMany']);
  assert.equal(context.writes[1].args.where?.plan, 'custom');
  assert.equal(context.writes[1].args.data.plan, 'renamed');
  assert.equal(context.writes[1].args.data.features, features);
  assert.equal(context.writes[1].args.data.maxWhatsappInstances, -1);
  for (const write of context.writes.slice(1)) {
    assert.equal(write.args.where?.plan, 'custom'); assert.equal(write.args.data.plan, 'renamed');
    assert.equal(write.args.data.features, features); assert.equal(write.args.data.maxWhatsappInstances, -1);
  }
});

test('PUT refuses propagating an invalid stored snapshot before updating the plan or tenants', async () => {
  const context = fixture('{');
  assert.equal((await context.put({ price: 65, propagateToOrgs: true })).status, 400);
  assert.equal(context.writes.length, 0);
});

test('PUT can explicitly repair features and propagate the repaired snapshot in the same request', async () => {
  const context = fixture('{');
  const response = await context.put({ features: '["atendimento"]', propagateToOrgs: true });
  assert.equal(response.status, 200);
  assert.equal((await response.json())._propagatedCount, 3);
  assert.equal(context.writes[1].args.data.features, '["atendimento"]');
});

test('POST/PUT invalid HTTP JSON returns 400 with no data writes', async () => {
  const context = fixture();
  assert.equal((await context.rawPost('{')).status, 400);
  assert.equal((await context.rawPut('{')).status, 400);
  assert.equal(context.writes.length, 0);
});

test('all plan handlers require the exclusive Super Admin role, before data writes', async () => {
  for (const role of [null, 'owner', 'admin', 'user']) {
    const context = fixture('["vendas"]', role);
    assert.equal((await context.post({ ...create })).status, 401);
    assert.equal((await context.put({ price: 65, propagateToOrgs: true })).status, 401);
    assert.equal((await context.get()).status, 401);
    assert.equal((await context.delete()).status, 401);
    assert.equal(context.writes.length, 0);
  }
});

test('GET exposes the existing organization count for the confirmation estimate', async () => {
  const response = await fixture().get();
  assert.equal(response.status, 200);
  assert.equal((await response.json())[0]._count.organizations, 3);
});
