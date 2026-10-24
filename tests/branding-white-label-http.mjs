// Actual NextAuth, separate Super Admin cookie and disposable PostgreSQL only.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '5432'); assert.equal(url.pathname, '/mds_crm_dev');
const db = new PrismaClient(), base = 'http://127.0.0.1:3100', fixtures = [], scenarios = [];
let admin;
class Client {
  cookies = new Map();
  constructor(ip) { this.ip = ip; }
  async request(path, options = {}) {
    const response = await fetch(base + path, { redirect: 'manual', ...options, headers: {
      'x-forwarded-for': this.ip, cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '), ...options.headers,
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], index = pair.indexOf('='); this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: response.status, location: response.headers.get('location'), body: await response.text() };
  }
  json(path, method, data) { return this.request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); }
  async login(user, password) {
    const csrfToken = JSON.parse((await this.request('/api/auth/csrf')).body).csrfToken;
    await this.request('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: user.email, password, csrfToken, callbackUrl: base + '/dashboard', json: 'true' }) });
    assert.equal(JSON.parse((await this.request('/api/auth/session')).body).user?.id, user.id);
  }
}
try {
  const suffix = crypto.randomUUID(), password = crypto.randomBytes(24).toString('hex'), passwordHash = await bcrypt.hash(password, 10);
  admin = await db.superAdmin.create({ data: { name: 'Local branding auditor', email: `branding-admin-${suffix}@example.invalid`, passwordHash } });
  const mds = new Client('198.51.100.90');
  assert.equal((await mds.json('/api/admin/auth', 'POST', { email: admin.email, password })).status, 200, 'Real Super Admin login');
  let rejectedClientChanges = 0, persistedUpdates = 0;
  const commercialDenials = [];
  for (const tenant of ['a', 'b']) {
    const org = await db.organization.create({ data: { name: `Brand fixture ${tenant}`, slug: `branding-${tenant}-${suffix}`, plan: 'trial', trialEndsAt: new Date(Date.now() + 86400000) } });
    const brand = { name: `Brand fixture ${tenant}`, logo: `/images/${tenant === 'a' ? 'logo-fundo-claro.png' : 'logo-mds.svg'}?brand=${tenant}`, favicon: `/images/${tenant === 'a' ? 'favicon.png' : 'logo-mds.svg'}?brand=${tenant}`, primaryColor: tenant === 'a' ? '#123456' : '#654321', secondaryColor: '#abcdef' };
    const fixture = { org, brand, clients: [] }; fixtures.push(fixture);
    for (const role of ['owner', 'admin', 'user']) {
      const permissions = Object.fromEntries(['leads', 'tasks', 'projects', 'os', 'agenda', 'kanban', 'reports', 'goals', 'integrations', 'settings', 'users', 'atendimento'].map(resource => [resource, { view: true, create: true, edit: true, delete: true }]));
      const user = await db.user.create({ data: { organizationId: org.id, role, name: 'Brand fixture ' + role, email: `brand-${tenant}-${role}-${suffix}@example.invalid`, passwordHash, permissions: JSON.stringify(permissions) } });
      const client = new Client('198.51.100.' + (100 + fixtures.length * 3 + fixture.clients.length));
      await client.login(user, password); fixture.clients.push({ role, user, client });
      const forbidden = await client.json(`/api/admin/organizations/${org.id}`, 'PUT', { whiteLabel: true });
      assert.ok([401, 403, 307].includes(forbidden.status), 'Tenant has no Super Admin access');
      if (forbidden.status === 307) assert.equal(new URL(forbidden.location, base).pathname, '/admin/login');
      commercialDenials.push({ role, tenant, status: forbidden.status, destination: forbidden.status === 307 ? '/admin/login' : null });
      rejectedClientChanges++;
      if (role !== 'user') {
        assert.equal((await client.json('/api/organizations', 'PATCH', brand)).status, 200, 'Existing tenant edit preserved'); persistedUpdates++;
        assert.equal((await client.json('/api/organizations', 'PATCH', { whiteLabel: true })).status, 400);
        assert.equal((await client.json('/api/organizations', 'PATCH', { features: '["white_label"]' })).status, 400);
        assert.equal((await client.json('/api/organizations', 'PATCH', { organizationId: 'foreign', name: 'Attempt' })).status, 400);
        assert.equal((await client.json('/api/organizations', 'PATCH', { logo: 'https://user:pass@example.invalid/logo.png' })).status, 400);
      } else assert.equal((await client.json('/api/organizations', 'PATCH', brand)).status, 403);
    }
    const persisted = await db.organization.findUnique({ where: { id: org.id } });
    for (const [key, value] of Object.entries(brand)) assert.equal(persisted[key], value);
    assert.equal((await fetch(base + brand.logo)).status, 200);
    assert.equal((await fetch(base + brand.favicon)).status, 200);
  }
  const modules = ['atendimento', 'vendas', 'marketing'];
  for (let mask = 1; mask < 8; mask++) for (const whiteLabel of [false, true]) for (const fixture of fixtures) {
    const contracted = modules.filter((_, i) => mask & (1 << i));
    await db.organization.update({ where: { id: fixture.org.id }, data: { features: JSON.stringify(contracted) } });
    const toggle = await mds.json(`/api/admin/organizations/${fixture.org.id}`, 'PUT', { whiteLabel });
    assert.equal(toggle.status, 200);
    const persisted = await db.organization.findUnique({ where: { id: fixture.org.id } });
    assert.deepEqual(JSON.parse(persisted.features), [...contracted, ...(whiteLabel ? ['white_label'] : [])]);
    for (const { role, client } of fixture.clients) {
      const dashboard = await client.request('/dashboard'); assert.equal(dashboard.status, 200);
      const expectedColor = whiteLabel ? fixture.brand.primaryColor : '#2f3453';
      const expectedIcon = whiteLabel ? fixture.brand.favicon : '/favicon.ico';
      const expectedLogo = whiteLabel ? fixture.brand.logo : '/images/logo-fundo-escuro.png';
      assert.ok(dashboard.body.includes('--color-primary: ' + expectedColor));
      assert.ok(dashboard.body.includes(`href="${expectedIcon}"`), 'Rendered favicon');
      assert.ok(dashboard.body.includes(expectedLogo), 'Server branding prop for Sidebar');
      if (!whiteLabel) assert.ok(!dashboard.body.includes(fixture.brand.logo) && !dashboard.body.includes(fixture.brand.favicon));
      const other = fixtures.find(item => item !== fixture);
      assert.ok(!dashboard.body.includes(other.brand.logo) && !dashboard.body.includes(other.brand.favicon));
      assert.equal(dashboard.body.includes('Total Leads'), contracted.includes('vendas'));
      assert.equal(dashboard.body.includes('Projetos Ativos'), contracted.includes('marketing'));
      const settings = await client.request('/api/organizations'); assert.equal(settings.status, 200);
      assert.equal(JSON.parse(settings.body).whiteLabelActive, whiteLabel);
      scenarios.push({ mask, modules: contracted, whiteLabel, role, tenant: fixtures.indexOf(fixture), passed: true });
    }
  }
  const target = fixtures[0], owner = target.clients[0];
  assert.equal((await mds.json(`/api/admin/organizations/${target.org.id}`, 'PUT', { whiteLabel: false, plan: 'enterprise' })).status, 400);
  await db.organization.update({ where: { id: target.org.id }, data: { features: '{invalid' } });
  assert.equal((await mds.json(`/api/admin/organizations/${target.org.id}`, 'PUT', { whiteLabel: true })).status, 409);
  await db.organization.update({ where: { id: target.org.id }, data: { features: '["vendas","legacy_opaque","white_label"]' } });
  assert.equal((await mds.json(`/api/admin/organizations/${target.org.id}`, 'PUT', { whiteLabel: false })).status, 200);
  assert.deepEqual(JSON.parse((await db.organization.findUnique({ where: { id: target.org.id } })).features), ['vendas', 'legacy_opaque']);
  await db.user.update({ where: { id: owner.user.id }, data: { permissions: '{"settings":{"view":false,"edit":false}}', role: 'user' } });
  assert.equal((await owner.client.json('/api/organizations', 'PATCH', { name: 'Denied' })).status, 403);
  const audits = await db.activity.findMany({ where: { entityId: { in: fixtures.map(item => item.org.id) }, description: 'Capacidade White-Label atualizada pela MDS' } });
  assert.equal(audits.length, 29);
  for (const audit of audits) { assert.equal(audit.userId, null); assert.equal(JSON.parse(audit.metadata).actorId, admin.id); }
  console.log(JSON.stringify({ referenceHead: 'd626bff', scenarios, persistedUpdates, rejectedClientChanges, commercialDenials, auditedCommercialUpdates: audits.length, assetRetrievals: 4, passed: true }, null, 2));
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : JSON.stringify({ name: error.name, code: error.code || null })); process.exitCode = 1;
} finally {
  if (fixtures.length) await db.activity.deleteMany({ where: { entityId: { in: fixtures.map(item => item.org.id) } } });
  for (const fixture of fixtures) await db.organization.delete({ where: { id: fixture.org.id } });
  if (admin) await db.superAdmin.delete({ where: { id: admin.id } });
  await db.$disconnect();
}
