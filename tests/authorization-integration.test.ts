import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest, NextResponse } from 'next/server';
import { createModuleAuthorizer, type AuthorizationUser, type ModuleAccessRequest } from '../src/lib/authorization/authorize';
import { authorizationEffect, type AuthorizationMode } from '../src/lib/authorization/policy';
import * as validation from '../src/lib/validations';
import { loadServerModule } from './helpers/load-server-module';

type Context = { params: Promise<{ id: string }> };
type Handlers = Record<'GET' | 'POST' | 'PUT' | 'DELETE', (request: NextRequest, context: Context) => Promise<Response>>;

function fixture(mode: AuthorizationMode = 'observe_only', features = '["marketing"]') {
  const record: AuthorizationUser = {
    id: 'fixture-user', organizationId: 'fixture-org', deletedAt: null, role: 'owner', permissions: '{}',
    organization: { id: 'fixture-org', deletedAt: null, plan: 'fixture-plan', planStatus: 'active', features, trialEndsAt: null, maxProjects: 5 },
  };
  const session = { user: { id: 'fixture-user', organizationId: 'fixture-org', role: 'owner' } };
  let databaseUnavailable = false; let legacyAllowed = true;
  const originalDenial = NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  const authorize = createModuleAuthorizer({ session: async () => session, readUser: async () => {
    if (databaseUnavailable) throw new Error('private details'); return record;
  } });
  const guards = loadServerModule<{ checkModulePermission: (request: ModuleAccessRequest) => Promise<unknown> }>(
    new URL('../src/lib/authorization/guards.ts', import.meta.url), {
      '../checkPermission': { checkPermission: async () => legacyAllowed
        ? { allowed: true, session, errorResponse: null } : { allowed: false, session, errorResponse: originalDenial } },
      './server': { evaluateModuleAccess: async (request: ModuleAccessRequest) => authorizationEffect(await authorize(request), mode) },
    });
  const reads: { id?: string; organizationId: string }[] = [];
  const writes: { operation: string; args: { where?: { id: string; organizationId?: string }; data?: Record<string, unknown> } }[] = [];
  const own = { id: 'own-project', organizationId: 'fixture-org', title: 'Synthetic project' };
  const prisma = { marketingProject: {
    findFirst: async (args: { where: { id: string; organizationId: string } }) => {
      reads.push(args.where);
      return args.where.id === own.id && args.where.organizationId === own.organizationId ? own : null;
    },
    findMany: async (args: { where: { organizationId: string } }) => {
      reads.push(args.where); return args.where.organizationId === own.organizationId ? [own] : [];
    },
    count: async () => 1,
    create: async (args: { data: Record<string, unknown> }) => { writes.push({ operation: 'create', args }); return args.data; },
    update: async (args: { where: { id: string; organizationId: string }; data: Record<string, unknown> }) => {
      writes.push({ operation: 'update', args }); return { ...own, ...args.data };
    },
    delete: async (args: { where: { id: string; organizationId: string } }) => { writes.push({ operation: 'delete', args }); return own; },
  } };
  const imports = {
    '@/lib/prisma': { prisma }, '@/lib/authorization/guards': guards,
    '@/lib/validations': validation,
    '@/lib/checkLimits': { checkPlanActive: async () => ({ active: true }), checkOrganizationLimit: async () => ({ allowed: true }) },
  };
  const item = loadServerModule<Handlers>(new URL('../src/app/api/projects/[id]/route.ts', import.meta.url), imports);
  const collection = loadServerModule<Handlers>(new URL('../src/app/api/projects/route.ts', import.meta.url), imports);
  function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', id = 'own-project', body?: unknown, list = false) {
    const request = new NextRequest('http://localhost/api/projects/' + id + '?organizationId=foreign-org&mode=enforce', {
      method, ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}), headers: { 'Content-Type': 'application/json' } } : {}),
    });
    return (list || method === 'POST' ? collection : item)[method](request, { params: Promise.resolve({ id }) });
  }
  return { call, reads, writes, record,
    failDatabase: () => { databaseUnavailable = true; }, denyLegacy: () => { legacyAllowed = false; }, originalDenial };
}

test('projects observe_only preserves the legacy successful API response even for empty/invalid features', async () => {
  for (const features of ['[]', '{', '["unknown"]']) {
    const context = fixture('observe_only', features);
    const response = await context.call('GET');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 'own-project', organizationId: 'fixture-org', title: 'Synthetic project' });
  }
});

test('projects observe_only records infrastructure denial while still requiring the original guard', async () => {
  const context = fixture(); context.failDatabase();
  assert.equal((await context.call('GET')).status, 200);
  context.denyLegacy();
  const response = await context.call('GET');
  assert.equal(response, context.originalDenial);
  assert.deepEqual(await response.json(), { error: 'Sem permissão' });
});

test('projects enforce (test-only policy injection) rejects missing module for owners before resource access', async () => {
  const context = fixture('enforce', '[]');
  for (const method of ['GET', 'PUT', 'DELETE', 'POST'] as const) {
    assert.equal((await context.call(method, 'own-project', { title: 'New' })).status, 403);
  }
  assert.equal(context.reads.length, 0); assert.equal(context.writes.length, 0);
});

test('projects enforce never grants access when infrastructure cannot be read', async () => {
  const context = fixture('enforce'); context.failDatabase();
  assert.equal((await context.call('GET')).status, 503);
  assert.equal(context.reads.length, 0);
});

test('foreign or fabricated URL IDs cannot read, modify or delete a project even in observe_only', async () => {
  const context = fixture('observe_only');
  for (const id of ['foreign-project', 'fabricated-project']) {
    for (const method of ['GET', 'PUT', 'DELETE'] as const) {
      const response = await context.call(method, id, { title: 'Attempt', organizationId: 'foreign-org' });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Projeto não encontrado' });
    }
  }
  assert.equal(context.writes.length, 0);
  assert.ok(context.reads.every((where) => where.organizationId === 'fixture-org'));
});

test('query, body tenant and owner IDs cannot override the session tenant or creator', async () => {
  const context = fixture();
  const response = await context.call('POST', 'ignored', { title: 'New', organizationId: 'foreign-org', ownerId: 'foreign-user', mode: 'enforce' });
  assert.equal(response.status, 201);
  assert.equal(context.writes[0].args.data?.organizationId, 'fixture-org');
  assert.equal(context.writes[0].args.data?.ownerId, 'fixture-user');
  const list = await context.call('GET', 'ignored', undefined, true);
  assert.equal(list.status, 200);
  assert.ok(context.reads.every((where) => where.organizationId === 'fixture-org'));
});

test('project mutation selectors are tenant-bound at the final write, not only at the pre-check', async () => {
  const context = fixture();
  assert.equal((await context.call('PUT', 'own-project', { title: 'Edited', organizationId: 'foreign-org', ownerId: 'foreign-user' })).status, 200);
  assert.equal((await context.call('DELETE')).status, 200);
  assert.ok(context.writes.every((write) => write.args.where?.organizationId === 'fixture-org'));
  assert.deepEqual(Object.keys(context.writes[0].args.data!), ['title']);
  assert.equal(context.writes[0].args.data?.title, 'Edited');
});

test('server page guard observes without changing rendering, and supports future enforced denial', async () => {
  const decision = { allowed: false, reason: 'module_not_contracted', status: 403 } as const;
  const events: string[] = [];
  let mode: AuthorizationMode = 'observe_only';
  const page = loadServerModule<{ checkModulePage: (request: ModuleAccessRequest) => Promise<void> }>(
    new URL('../src/lib/authorization/page.ts', import.meta.url), {
      './server': { evaluateModuleAccess: async () => authorizationEffect(decision, mode) },
      './guards': { recordAuthorizationObservation: () => { events.push('observed'); } },
      'next/navigation': { redirect: () => { throw new Error('redirect'); }, notFound: () => { throw new Error('not-found'); } },
    });
  await page.checkModulePage({ module: 'marketing', permission: 'projects', action: 'view' });
  assert.deepEqual(events, ['observed']);
  mode = 'enforce';
  await assert.rejects(page.checkModulePage({ module: 'marketing', permission: 'projects', action: 'view' }), /not-found/);
});

test('enforced guard cannot apply a successful authorization from another user/tenant to the legacy operation', async () => {
  const guards = loadServerModule<{ checkModulePermission: (request: ModuleAccessRequest) => Promise<{ allowed: boolean; errorResponse: Response }> }>(
    new URL('../src/lib/authorization/guards.ts', import.meta.url), {
      '../checkPermission': { checkPermission: async () => ({ allowed: true, session: { user: { id: 'fixture-user', organizationId: 'fixture-org' } }, errorResponse: null }) },
      './server': { evaluateModuleAccess: async () => authorizationEffect({
        allowed: true, reason: 'allowed', status: 200, context: { userId: 'another-user', organizationId: 'another-org' },
      }, 'enforce') },
    });
  const result = await guards.checkModulePermission({ module: 'marketing', permission: 'projects', action: 'view' });
  assert.equal(result.allowed, false);
  assert.equal(result.errorResponse.status, 403);
  assert.equal(JSON.stringify(await result.errorResponse.json()).includes('another-org'), false);
});
