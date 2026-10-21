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
    const org = await db.organization.create({ data: { name: 'Commercial fixture ' + tenant, slug: `commercial-${tenant}-${suffix}`, plan: 'trial', trialEndsAt: new Date(Date.now() + 86400000) } });
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
    await db.marketingProject.create({ data: { title: 'Fixture project', organizationId: org.id, ownerId: owner.id, status: 'active' } });
    await db.task.createMany({ data: [
      { title: fixture.task, organizationId: org.id, type: 'task', dueDate: new Date() },
      { title: fixture.follow, organizationId: org.id, type: 'follow_up', leadId: lead.id, dueDate: new Date() },
    ] });
  }
  for (let mask = 1; mask < 8; mask++) for (const fixture of fixtures) {
    const contracted = modules.filter((_, i) => mask & (1 << i));
    await db.organization.update({ where: { id: fixture.org.id }, data: { features: JSON.stringify(contracted) } });
    for (const { role, client } of fixture.clients) {
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
      const directPages = {};
      if (role === 'owner') for (const path of ['/leads', '/projects']) {
        directPages[path] = (await client.request(path)).status;
        assert.equal(directPages[path], 200, 'Direct pages retain observe_only behavior');
      }
      results.push({ directPages, mask, modules: contracted, tenant: fixtures.indexOf(fixture), role, dashboard: dashboard.status, leadsApi: api.status, passed: true });
    }
  }
  // Invalid/empty subscriptions cannot inherit commercial rights from a plan or owner.
  for (const features of ['[]', '{invalid', '["white_label","financeiro"]']) {
    await db.organization.update({ where: { id: fixtures[0].org.id }, data: { features } });
    const dashboard = await fixtures[0].clients[0].client.request('/dashboard');
    assert.equal(dashboard.status, 200);
    assert.ok(!dashboard.body.includes('Total Leads') && !dashboard.body.includes('Projetos Ativos'));
  }
  console.log(JSON.stringify({ referenceHead: '192a110', scenarios: results, invalidConfigurations: 3, passed: true }, null, 2));
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : JSON.stringify({ stage, name: error.name, code: error.code || null }));
  process.exitCode = 1;
} finally {
  for (const fixture of fixtures) await db.organization.delete({ where: { id: fixture.org.id } });
  await db.$disconnect();
}
