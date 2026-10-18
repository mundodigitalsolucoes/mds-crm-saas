import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadServerModule } from './helpers/load-server-module';
import { salesFixture, OPERATIONS, ORG, OTHER_ORG, OWN, FOREIGN, USER, FOREIGN_USER, TAG, FOREIGN_TAG, OWN_STAGE, FOREIGN_STAGE } from './helpers/sales-fixture';
import type { ModuleAccessRequest } from '../src/lib/authorization/authorize';
import { authorizationEffect, modeForOrganization } from '../src/lib/authorization/policy';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test('all 16 Vendas methods use the current operational permission/action and preserve successful contracts in observe_only', async () => {
  const f = salesFixture();
  for (const [route, method, permission, action] of OPERATIONS) {
    const response = await f.call(route, method, { query: 'tagId=' + TAG });
    assert.equal(response.status, method === 'POST' && ['leads', 'tags', 'stages'].includes(route) ? 201 : 200, `${method} ${route}`);
    const evaluation = f.evaluations.at(-1)!;
    assert.deepEqual(plain(evaluation.request), { module: 'vendas', permission, action });
    assert.equal(evaluation.decision.allowed, true);
  }
  assert.equal(f.evaluations.length, OPERATIONS.length);
});

for (const scenario of ['no-session', 'removed', 'missing-user', 'invalid-organization', 'inactive-organization'] as const) {
  test(`Vendas ${scenario}: legacy identity/tenant denial stops all methods before resource access in observe_only`, async () => {
    const f = salesFixture();
    if (scenario === 'no-session') f.state.session = null;
    if (scenario === 'removed') f.actor.deletedAt = new Date();
    if (scenario === 'missing-user') f.state.user = null;
    if (scenario === 'invalid-organization') f.actor.organizationId = OTHER_ORG;
    if (scenario === 'inactive-organization') f.actor.organization!.deletedAt = new Date();
    for (const [route, method] of OPERATIONS) {
      assert.equal((await f.call(route, method)).status,
        scenario === 'missing-user' ? 404 : ['invalid-organization', 'inactive-organization'].includes(scenario) ? 403 : 401);
    }
    assert.equal(f.calls.length, 0); assert.equal(f.evaluations.length, 0);
  });
}

for (const role of ['owner', 'admin']) {
  test(`Vendas ${role} without entitlement: theoretical denial, legacy flow preserved, enforcement injectable only in tests`, async () => {
    for (const mode of ['observe_only', 'enforce'] as const) {
      const f = salesFixture(mode); f.actor.role = role; f.actor.organization!.features = '[]';
      for (const [route, method] of OPERATIONS) {
        const response = await f.call(route, method, { query: 'tagId=' + TAG });
        assert.equal(response.status, mode === 'enforce' ? 403 : method === 'POST' && ['leads', 'tags', 'stages'].includes(route) ? 201 : 200);
        assert.equal(f.evaluations.at(-1)!.decision.reason, 'module_not_contracted');
      }
      if (mode === 'enforce') assert.equal(f.calls.length, 0);
    }
  });
}

test('contracted Vendas without individual permissions remains denied by the actual legacy helper on all methods', async () => {
  const f = salesFixture(); f.actor.role = 'user';
  f.actor.permissions = JSON.stringify({ leads: { view: false, create: false, edit: false, delete: false }, kanban: { view: false, create: false, edit: false, delete: false } });
  for (const [route, method] of OPERATIONS) assert.equal((await f.call(route, method)).status, 403);
  assert.equal(f.calls.length, 0); assert.equal(f.evaluations.length, 0);
});

test('per-action operational grants are preserved: view never grants create, edit, delete or stage management', async () => {
  const f = salesFixture(); f.actor.role = 'user';
  f.actor.permissions = JSON.stringify({ leads: { view: true, create: false, edit: false, delete: false }, kanban: { view: true, create: false, edit: false, delete: false } });
  for (const [route, method, , action] of OPERATIONS) assert.equal((await f.call(route, method)).status, action === 'view' ? 200 : 403);
});

test('a contracted individual with explicit operational grants can use every Vendas operation; unknown extras grant nothing new', async () => {
  const f = salesFixture('enforce'); f.actor.role = 'user';
  f.actor.organization!.features = '["vendas", "opaque_legacy"]';
  f.actor.permissions = JSON.stringify({ leads: { view: true, create: true, edit: true, delete: true }, kanban: { view: true, create: true, edit: true, delete: true } });
  for (const [route, method] of OPERATIONS) {
    const response = await f.call(route, method, { query: 'tagId=' + TAG });
    assert.equal(response.status, method === 'POST' && ['leads', 'tags', 'stages'].includes(route) ? 201 : 200);
    assert.equal(f.evaluations.at(-1)!.decision.allowed, true);
  }
});

test('inactive subscriptions, malformed/unknown features and engine outages stay negative decisions; observe preserves the legacy read', async () => {
  for (const scenario of ['inactive', 'invalid', 'unknown', 'planned', 'outage']) {
    for (const mode of ['observe_only', 'enforce'] as const) {
      const f = salesFixture(mode);
      if (scenario === 'inactive') f.actor.organization!.planStatus = 'cancelled';
      if (scenario === 'invalid') f.actor.organization!.features = '{';
      if (scenario === 'unknown') f.actor.organization!.features = '["sales", "opaque_legacy"]';
      if (scenario === 'planned') f.actor.organization!.features = '["financeiro", "agentes_ia"]';
      if (scenario === 'outage') f.state.newEngineUnavailable = true;
      const response = await f.call('lead');
      assert.equal(response.status, mode === 'observe_only' ? 200 : scenario === 'outage' ? 503 : 403);
      assert.equal(f.evaluations[0].decision.reason, scenario === 'inactive' ? 'inactive_subscription' : scenario === 'outage' ? 'infrastructure_error' : 'module_not_contracted');
      if (mode === 'enforce') assert.equal(f.calls.length, 0);
    }
  }
});

test('existing create plan/limit checks still block even while the new engine observes', async () => {
  const f = salesFixture(); f.state.legacyPlanActive = false;
  let response = await f.call('leads', 'POST');
  assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: 'legacy-plan' });
  f.state.legacyPlanActive = true; f.state.legacyLimitAllowed = false;
  response = await f.call('leads', 'POST');
  assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: 'legacy-limit' });
  assert.equal(f.writes.length, 0);
});

test('foreign/fabricated lead IDs cannot be read, edited, deleted, moved or tagged even in observe_only', async () => {
  const f = salesFixture();
  for (const id of [FOREIGN, '99999999-0000-4000-8000-000000000099']) {
    for (const [route, method] of OPERATIONS.filter(([route]) => ['lead', 'stage', 'tags'].includes(route))) {
      const response = await f.call(route, method, { id, query: 'tagId=' + TAG });
      assert.equal(response.status, 404, `${method} ${route}`);
      assert.equal(JSON.stringify(await response.json()).includes('Private'), false);
    }
  }
  assert.equal(f.writes.length, 0);
});

test('listing retains tenant, pagination, ordering and filter predicates despite manipulated query/header', async () => {
  const f = salesFixture();
  const response = await f.call('leads', 'GET', { query: 'status=new&source=manual&city=Test&search=Alice&inKanban=true&hasWhatsapp=true&hasWebsite=true&minScore=10&page=2&limit=25' });
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.leads.length, 0);
  assert.deepEqual(body.pagination, { total: 1, page: 2, limit: 25, totalPages: 1 });
  const query = f.calls.find((c) => c.model === 'lead' && c.op === 'findMany')!.args;
  assert.equal(query.where!.organizationId, ORG); assert.equal(query.skip, 25); assert.equal(query.take, 25);
  assert.deepEqual(plain(query.orderBy), { createdAt: 'desc' });
  const filters = plain(query.where!.AND);
  assert.ok(filters.some((v: any) => v.status === 'new'));
  assert.ok(filters.some((v: any) => v.city?.contains === 'Test'));
  assert.ok(filters.some((v: any) => v.score?.gte === 10));
  assert.ok(filters.some((v: any) => v.OR?.some((entry: any) => entry.name?.contains === 'Alice')));
  const firstPage = await (await f.call('leads', 'GET')).json();
  assert.deepEqual(firstPage.leads.map((lead: any) => lead.id), [OWN]);
});

test('lead detail keeps task/activity/conversation contracts and scopes tenant-owned child collections', async () => {
  const f = salesFixture(); assert.equal((await f.call('lead')).status, 200);
  const include = f.calls.find((c) => c.model === 'lead' && c.op === 'findFirst')!.args.include;
  assert.equal(include.assignedTo.where.organizationId, ORG); assert.equal(include.createdBy.where.organizationId, ORG);
  assert.equal(include.tasks.where.organizationId, ORG); assert.equal(include.chatwootConversations.where.organizationId, ORG);
  assert.equal(include.tasks.take, 10); assert.equal(include.activities.take, 20); assert.equal(include.chatwootConversations.take, 5);
});

test('create/update cannot overwrite tenant, creator or protected provider fields; final mutations repeat tenant', async () => {
  const f = salesFixture();
  assert.equal((await f.call('leads', 'POST', { body: { name: 'New', organizationId: OTHER_ORG, createdById: FOREIGN_USER, chatwootContactId: 999 } })).status, 201);
  const create = f.writes.find((w) => w.model === 'lead' && w.op === 'create')!.args.data;
  assert.equal(create.organizationId, ORG); assert.equal(create.createdById, USER); assert.equal(create.chatwootContactId, undefined);
  assert.equal((await f.call('lead', 'PUT', { body: { name: 'Edited', organizationId: OTHER_ORG, createdById: FOREIGN_USER, chatwootContactId: 999 } })).status, 200);
  const update = f.writes.find((w) => w.model === 'lead' && w.op === 'update')!;
  assert.deepEqual(plain(update.args.data), { name: 'Edited' });
  assert.equal((await f.call('stage', 'PATCH')).status, 200);
  assert.equal((await f.call('lead', 'DELETE')).status, 200);
  assert.ok(f.writes.filter((w) => w.model === 'lead' && ['update', 'delete'].includes(w.op)).every((w) => w.args.where!.organizationId === ORG));
  assert.ok(f.writes.some((w) => w.model === 'activity' && w.args.data.action === 'stage_changed'));
});

test('foreign/deleted assignees cannot be linked or notified; tenant assignee and clearing remain supported', async () => {
  const f = salesFixture();
  for (const [route, method] of [['leads', 'POST'], ['lead', 'PUT']] as const) {
    assert.equal((await f.call(route, method, { body: { name: 'Attempt', assignedToId: FOREIGN_USER } })).status, 400);
  }
  assert.equal(f.writes.length, 0); assert.equal(f.notifications.length, 0);
  f.records.user[0].deletedAt = new Date();
  assert.equal((await f.call('leads', 'POST', { body: { name: 'Attempt', assignedToId: USER } })).status, 400);
  f.records.user[0].deletedAt = null;
  assert.equal((await f.call('leads', 'POST', { body: { name: 'Assigned', assignedToId: USER } })).status, 201);
  assert.equal((await f.call('lead', 'PUT', { body: { assignedToId: null } })).status, 200);
});

for (const route of ['bulk-update', 'bulk-delete'] as const) {
  test(`${route} rejects mixed/external/duplicate IDs wholly and preserves scoped success/count contract`, async () => {
    const f = salesFixture();
    const payload = route === 'bulk-update' ? { action: 'setInKanban', inKanban: false } : { confirmationText: 'EXCLUIR' };
    for (const ids of [[OWN, FOREIGN], [FOREIGN], [OWN, OWN]]) {
      assert.equal((await f.call(route, 'POST', { body: { ...payload, ids, organizationId: OTHER_ORG } })).status, 400);
    }
    assert.equal(f.writes.length, 0);
    const response = await f.call(route, 'POST', { body: { ...payload, ids: [OWN], organizationId: OTHER_ORG } });
    assert.equal(response.status, 200);
    const body = await response.json(); assert.equal(body.success, true); assert.equal(body[route === 'bulk-update' ? 'updatedCount' : 'deletedCount'], 1);
    assert.equal(f.writes[0].args.where!.organizationId, ORG);
    assert.deepEqual(plain(f.writes[0].args.where!.id), { in: [OWN] });
  });
}

test('bulk status keeps existing enum/flags; custom text remains rejected by the existing schema', async () => {
  const f = salesFixture();
  assert.equal((await f.call('bulk-update', 'POST', { body: { ids: [OWN], action: 'setStatus', status: 'won' } })).status, 200);
  assert.deepEqual(plain(f.writes[0].args.data), { status: 'won' });
  const before = f.writes.length;
  assert.equal((await f.call('bulk-update', 'POST', { body: { ids: [OWN], action: 'setStatus', status: OWN_STAGE } })).status, 400);
  assert.equal(f.writes.length, before);
});

test('import ignores manipulated organization/user/provider fields and preserves normalization, partial results and nameless legacy failure', async () => {
  const f = salesFixture();
  const response = await f.call('import', 'POST', { body: { organizationId: OTHER_ORG, leads: [
    { nome: ' Importado ', organizationId: OTHER_ORG, createdById: FOREIGN_USER, assignedToId: FOREIGN_USER, chatwootContactId: 999, score: '120', valor: '12,5', inKanban: 'não' },
    { name: '' }, { name: 'Custom', status: OWN_STAGE }, { name: 'External', status: FOREIGN_STAGE },
  ] } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sucesso: 2, falhas: 2, total: 4, message: '2 leads importados com sucesso, 2 falharam' });
  assert.equal(f.writes.length, 2);
  const data = f.writes[0].args.data;
  assert.equal(data.organizationId, ORG); assert.equal(data.name, 'Importado'); assert.equal(data.score, 100); assert.equal(data.value, 12.5); assert.equal(data.inKanban, false);
  for (const key of ['createdById', 'assignedToId', 'chatwootContactId']) assert.equal(data[key], undefined);
});

test('tags enforce ownership on both sides before associating/removing and filter corrupt legacy foreign links on reads', async () => {
  const f = salesFixture();
  for (const method of ['POST', 'DELETE']) {
    assert.equal((await f.call('tags', method, { body: { tagId: FOREIGN_TAG }, query: 'tagId=' + FOREIGN_TAG })).status, 404);
  }
  assert.equal(f.writes.length, 0);
  const response = await f.call('tags'); assert.deepEqual(await response.json(), { tags: [f.records.tag[0]] });
  assert.equal((await f.call('tags', 'POST')).status, 201);
  const upsert = f.writes.find((w) => w.op === 'upsert')!.args;
  assert.equal(upsert.where!.lead.organizationId, ORG); assert.equal(upsert.where!.tag.organizationId, ORG);
  assert.equal(upsert.create.lead.connect.organizationId, ORG); assert.equal(upsert.create.tag.connect.organizationId, ORG);
  assert.equal((await f.call('tags', 'DELETE', { query: 'tagId=' + TAG })).status, 200);
  const where = f.writes.find((w) => w.model === 'leadTag' && w.op === 'deleteMany')!.args.where!;
  assert.equal(where.lead.organizationId, ORG); assert.equal(where.tag.organizationId, ORG);
});

test('foreign or unknown custom stages are rejected on each scalar-status write path without mutating foreign data', async () => {
  const f = salesFixture();
  for (const status of [FOREIGN_STAGE, 'fabricated-stage']) {
    for (const [route, method] of [['leads', 'POST'], ['lead', 'PUT'], ['stage', 'PATCH']] as const) {
      assert.equal((await f.call(route, method, { body: { name: 'Attempt', status } })).status, 400);
    }
  }
  assert.equal(f.writes.length, 0);
  assert.ok(f.calls.every((c) => !c.args.where || c.args.where.organizationId === ORG));
});

test('native/default, tenant custom and tenant-local legacy states remain usable without migration; partial edits omit relation review', async () => {
  const f = salesFixture(); f.records.lead[0].status = 'orphan_legacy';
  for (const status of ['new', 'contacted', 'contact', 'closed', 'won', 'lost', OWN_STAGE, 'orphan_legacy']) {
    assert.equal((await f.call('stage', 'PATCH', { body: { status } })).status, 200);
  }
  const response = await f.call('lead', 'PUT', { body: { status: 'Em contato' } });
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'contact');
  f.state.relationUnavailable = true;
  assert.equal((await f.call('lead', 'PUT', { body: { notes: 'Partial only' } })).status, 200);
});

test('relation lookup failure never authorizes a custom destination or imports it as a successful row', async () => {
  const f = salesFixture(); f.state.relationUnavailable = true;
  assert.equal((await f.call('stage', 'PATCH')).status, 500);
  const response = await f.call('import', 'POST', { body: { leads: [{ name: 'Custom', status: OWN_STAGE }] } });
  assert.equal(response.status, 200); assert.equal((await response.json()).falhas, 1);
  assert.equal(f.writes.length, 0);
});

test('stage CRUD scopes key and final mutation, ignores client tenant, and preserves system flags/order', async () => {
  const f = salesFixture();
  for (const method of ['PUT', 'DELETE']) assert.equal((await f.call('stage-item', method, { key: FOREIGN_STAGE })).status, 404);
  assert.equal(f.writes.length, 0);
  assert.equal((await f.call('stages', 'POST', { body: { title: 'Novo', color: 'green', organizationId: OTHER_ORG, isSystem: true } })).status, 201);
  const created = f.writes[0].args.data;
  assert.equal(created.organizationId, ORG); assert.equal(created.isSystem, false); assert.equal(created.isDefault, false); assert.equal(created.order, 8);
  assert.equal((await f.call('stage-item', 'PUT', { body: { title: 'Edit', order: 4, color: 'purple', organizationId: OTHER_ORG } })).status, 200);
  assert.equal((await f.call('stage-item', 'DELETE')).status, 200);
  assert.ok(f.writes.filter((w) => ['update', 'delete'].includes(w.op)).every((w) => w.args.where!.organizationId === ORG));
});

test('stage deletion with active pipeline leads still returns legacy 409; default initialization stays scoped', async () => {
  const f = salesFixture(); f.records.lead[0].status = OWN_STAGE;
  assert.equal((await f.call('stage-item', 'DELETE')).status, 409); assert.equal(f.writes.length, 0);
  f.records.leadPipelineStage = f.records.leadPipelineStage.filter((s) => s.organizationId !== ORG);
  assert.equal((await f.call('stages')).status, 200);
  const seed = f.writes.find((w) => w.op === 'createMany')!.args;
  assert.equal(seed.skipDuplicates, true); assert.equal(seed.data.length, 7);
  assert.ok(seed.data.every((stage: any) => stage.organizationId === ORG && stage.isDefault && stage.isSystem));
});

test('the same stage key in two organizations only reads/mutates the local stage', async () => {
  const f = salesFixture(); f.records.leadPipelineStage[1].key = OWN_STAGE;
  const stages = await (await f.call('stages')).json(); assert.equal(stages.stages.length, 1);
  assert.equal((await f.call('stage-item', 'PUT')).status, 200);
  const mutation = f.writes.find((w) => w.op === 'update')!;
  assert.equal(mutation.args.where!.id, 'own-stage-id'); assert.equal(mutation.args.where!.organizationId, ORG);
  assert.equal((await f.call('stage', 'PATCH')).status, 200);
  assert.ok(f.calls.filter((c) => c.model === 'leadPipelineStage').every((c) => c.args.where!.organizationId === ORG));
});

test('sales layouts invoke the shared server page guard with the correct permissions; session absence redirects before returning children', async () => {
  for (const [folder, name] of [['leads', 'Leads'], ['kanban', 'SalesPipeline']]) {
    const requests: ModuleAccessRequest[] = [];
    let authenticated = false;
    const page = loadServerModule<{ checkModulePage: (request: ModuleAccessRequest) => Promise<void> }>(new URL('../src/lib/authorization/page.ts', import.meta.url), {
      './server': { evaluateModuleAccess: async () => authorizationEffect(authenticated
        ? { allowed: false, reason: 'module_not_contracted', status: 403 }
        : { allowed: false, reason: 'unauthenticated', status: 401 }, 'observe_only') },
      './guards': { recordAuthorizationObservation: (req: ModuleAccessRequest) => { requests.push(req); } },
      'next/navigation': { redirect: (path: string) => { throw new Error('redirect:' + path); }, notFound: () => assert.fail('observe_only cannot block commerce') },
    });
    const layout = loadServerModule<{ default: (props: { children: string }) => Promise<unknown> }>(new URL(`../src/app/(app)/${folder}/layout.tsx`, import.meta.url), {
      '@/lib/authorization/page': page,
      'react/jsx-runtime': { jsx: (_tag: unknown, props: unknown) => props, Fragment: 'fragment' },
    });
    await assert.rejects(layout.default({ children: 'protected-child' }), /redirect:\/auth\/login/, name);
    assert.deepEqual(plain(requests[0]), { module: 'vendas', permission: folder, action: 'view' });
    authenticated = true;
    assert.deepEqual(plain(await layout.default({ children: 'protected-child' })), { children: 'protected-child' });
  }
});

test('server enforcement manifest is empty and no client-selected mode/tenant can activate it', () => {
  for (const organization of [ORG, OTHER_ORG, 'enforce', undefined]) assert.equal(modeForOrganization(organization), 'observe_only');
  const policy = readFileSync(new URL('../src/lib/authorization/policy.ts', import.meta.url), 'utf8');
  assert.match(policy, /const APPROVED_ENFORCEMENTS: readonly EnforcementApproval\[\] = \[\];/);
});
