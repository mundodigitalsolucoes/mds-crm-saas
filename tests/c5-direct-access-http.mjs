// Functional local-only matrix. Requires a built Next app on loopback:3100.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '5432');
assert.equal(url.pathname, '/mds_crm_dev');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3100';
const fixtures = [];
const results = [];
let stage = 'setup';
class Client {
  constructor(ip) { this.ip = ip; }
  cookies = new Map();
  async request(path, options = {}) {
    const response = await fetch(base + path, { redirect: 'manual', ...options, headers: {
      'x-forwarded-for': this.ip,
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers,
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: response.status, body: await response.text() };
  }
  async login(user, password) {
    const csrfToken = JSON.parse((await this.request('/api/auth/csrf')).body).csrfToken;
    await this.request('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: user.email, password, csrfToken, callbackUrl: base + '/dashboard', json: 'true' }) });
    assert.equal(JSON.parse((await this.request('/api/auth/session')).body).user?.id, user.id, 'Authenticated fixture session required');
  }
}
try {
  const suffix = crypto.randomUUID();
  const password = crypto.randomBytes(24).toString('hex');
  const passwordHash = await bcrypt.hash(password, 10);
  const modules = ['atendimento', 'vendas', 'marketing'];
  for (const tenant of ['a', 'b']) {
    stage = 'organization';
    const org = await db.organization.create({ data: { name: 'C5 fixture ' + tenant, slug: `c5-direct-${tenant}-${suffix}`, plan: 'trial', trialEndsAt: new Date(Date.now() + 86400000) } });
    const fixture = { org, clients: [], marker: `lead-${tenant}-${suffix}`, task: `task-${tenant}-${suffix}`, follow: `follow-${tenant}-${suffix}` };
    fixtures.push(fixture);
    for (const role of ['owner', 'admin', 'user']) {
      const permissions = Object.fromEntries(['leads', 'tasks', 'projects', 'os', 'agenda', 'kanban', 'reports', 'goals', 'integrations', 'settings', 'users', 'atendimento'].map(resource => [resource, { view: role !== 'user' || resource !== 'leads', create: true, edit: true, delete: true }]));
      const user = await db.user.create({ data: { name: 'Fixture ' + role, email: `${tenant}-${role}-${suffix}@example.invalid`, passwordHash, organizationId: org.id, role, permissions: JSON.stringify(permissions) } });
      const client = new Client('198.51.100.' + (30 + fixtures.length * 3 + fixture.clients.length));
      stage = 'login';
      await client.login(user, password);
      fixture.clients.push({ role, user, client });
    }
    stage = 'resources';
    const owner = fixture.clients[0].user;
    const lead = await db.lead.create({ data: { name: fixture.marker, organizationId: org.id, createdById: owner.id } });
    fixture.leadId = lead.id;
    const project = await db.marketingProject.create({ data: { title: 'Fixture project', organizationId: org.id, ownerId: owner.id, status: 'active' } });
    fixture.projectId = project.id;
    await db.task.createMany({ data: [
      { title: fixture.task, organizationId: org.id, type: 'task', dueDate: new Date() },
      { title: fixture.follow, organizationId: org.id, type: 'follow_up', leadId: lead.id, dueDate: new Date() },
    ] });
  }
  for (let mask = 1; mask < 8; mask++) for (const whiteLabel of [false, true]) for (const fixture of fixtures) {
    const contracted = modules.filter((_, i) => mask & (1 << i));
    await db.organization.update({ where: { id: fixture.org.id }, data: { features: JSON.stringify([...contracted, ...(whiteLabel ? ['white_label'] : [])]) } });
    for (const { role, client } of fixture.clients) {
      client.ip = `198.18.${mask}.${(whiteLabel ? 100 : 10) + fixtures.indexOf(fixture) * 3 + ['owner', 'admin', 'user'].indexOf(role)}`;
      stage = 'dashboard';
      const dashboard = await client.request('/dashboard');
      assert.equal(dashboard.status, 200);
      const sales = contracted.includes('vendas'), marketing = contracted.includes('marketing');
      const leadVisible = sales && role !== 'user';
      assert.equal(dashboard.body.includes(fixture.marker), leadVisible, 'Lead data');
      assert.equal(dashboard.body.includes('Total Leads'), leadVisible, 'Lead indicator');
      assert.equal(dashboard.body.includes('Projetos Ativos'), marketing, 'Project indicator');
      assert.equal(dashboard.body.includes(fixture.task), marketing, 'Operational task');
      assert.equal(dashboard.body.includes(fixture.follow), leadVisible, 'Lead-linked follow-up');
      const other = fixtures.find(item => item !== fixture);
      assert.equal(dashboard.body.includes(other.marker), false, 'Tenant isolation');
      const api = await client.request('/api/leads');
      assert.equal(api.status, role === 'user' ? 403 : 200, 'observe_only API behavior preserved');
      const directPages = {}, apiOperations = [];
      for (const path of ['/atendimento', '/leads', '/kanban', '/agenda', '/follow-ups', '/goals', '/projects', '/os', '/tasks', '/reports', '/settings/atendimento/widget']) {
        const response = await client.request(path);
        directPages[path] = response.status;
        assert.equal(response.status, 200, path + ' returns authenticated shell in observe_only');
        assert.equal(response.body.includes(other.marker), false);
      }
      for (const path of ['/api/leads', '/api/projects', '/api/kanban/stages', '/api/tasks', '/api/agenda', '/api/os', '/api/goals', '/api/atendimento/widget']) {
        const response = await client.request(path);
        const expected = path === '/api/leads' && role === 'user' ? 403 : 200;
        assert.equal(response.status, expected, path);
        for (const foreign of [other.marker, other.leadId, other.projectId, other.org.id]) assert.equal(response.body.includes(foreign), false, path + ' excludes foreign root entity');
        if (path === '/api/atendimento/widget') assert.equal(JSON.parse(response.body).orgScope.id, fixture.org.id);
        apiOperations.push({ url: path, method: 'GET', status: response.status, leadDataDespiteDeniedPermission: path === '/api/tasks' && role === 'user' && response.body.includes(fixture.marker) });
      }
      for (const [path, id] of [['leads', other.leadId], ['projects', other.projectId]]) {
        const response = await client.request(`/api/${path}/${id}`);
        assert.ok([403, 404].includes(response.status));
        assert.equal(response.body.includes(other.marker), false);
        apiOperations.push({ url: `/api/${path}/[foreign-id]`, method: 'GET', status: response.status });
      }
      const attemptedPromotion = await client.request('/api/projects?mode=enforce');
      assert.equal(attemptedPromotion.status, 200, 'A query flag must not enable enforcement');
      results.push({ directPages, apiOperations, mask, whiteLabel, modules: contracted, tenant: fixtures.indexOf(fixture), role, dashboard: dashboard.status, leadsApi: api.status, passed: true });
    }
  }
  const anonymous = new Client('198.51.100.195');
  const anonymousResults = [];
  for (const path of ['/atendimento','/leads','/projects','/api/leads','/api/projects','/api/atendimento/widget','/api/tasks','/api/os']) {
    const response = await anonymous.request(path);
    assert.ok([401,403,307].includes(response.status), path);
    anonymousResults.push({ url: path, status: response.status });
  }
  // Invalid/empty subscriptions cannot inherit commercial rights from a plan or owner.
  for (const features of ['[]', '{invalid', '["white_label","financeiro"]']) {
    await db.organization.update({ where: { id: fixtures[0].org.id }, data: { features } });
    const dashboard = await fixtures[0].clients[0].client.request('/dashboard');
    assert.equal(dashboard.status, 200);
    assert.ok(!dashboard.body.includes('Total Leads') && !dashboard.body.includes('Projetos Ativos'));
  }
  const relatedPermissionFailures = results.filter(row => row.apiOperations.some(operation => operation.leadDataDespiteDeniedPermission)).length;
  console.log(JSON.stringify({ referenceHead: '5f0f8a9', scenarios: results, anonymousResults, invalidConfigurations: 3, observeOnlyBaselinePassed: true, relatedPermissionFailures, securityAcceptancePassed: relatedPermissionFailures === 0 }, null, 2));
  if (relatedPermissionFailures) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : JSON.stringify({ stage, name: error.name, code: error.code || null }));
  process.exitCode = 1;
} finally {
  for (const fixture of fixtures) await db.organization.delete({ where: { id: fixture.org.id } });
  await db.$disconnect();
}
