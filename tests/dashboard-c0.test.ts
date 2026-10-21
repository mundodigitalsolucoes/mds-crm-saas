import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerModule } from './helpers/load-server-module';

for (const resource of ['leads', 'projects', 'tasks', 'os', 'users', 'all']) {
  test(`Dashboard never queries denied resource: ${resource}`, async () => {
    const calls: string[] = [];
    const model = (name: string) => ({
      count: async (query: { where: { organizationId: string } }) => { assert.equal(query.where.organizationId, 'tenant-a'); calls.push(name); return 1; },
      findMany: async (query: { where: { organizationId: string } }) => { assert.equal(query.where.organizationId, 'tenant-a'); calls.push(name); return []; },
      findFirst: async () => ({ plan: 'trial' }),
    });
    const session = { user: { id: 'u', organizationId: 'tenant-a' } };
    const page = loadServerModule<{ default: () => Promise<unknown> }>(
      new URL('../src/app/(app)/dashboard/page.tsx', import.meta.url), {
        '@/lib/checkPermission': {
          checkAuth: async () => ({ authenticated: true, session }),
          checkPermission: async (module: string) => ({ allowed: resource !== 'all' && module !== resource, session }),
        },
        '@/lib/prisma': { prisma: {
          lead: model('leads'), marketingProject: model('projects'), task: model('tasks'),
          serviceOrder: model('os'), user: model('users'), organization: model('organization'),
        } },
        'next/navigation': { redirect: () => { throw Error('redirect'); } },
      });
    await page.default();
    assert.ok(resource === 'all' ? calls.length === 0 : !calls.includes(resource));
  });
}
for (const component of ['dashboard/page', 'layout']) {
  test(`${component} denies inactive identity before any resource query`, async () => {
    const denied = new Proxy({}, { get() { throw Error('Unexpected data access'); } });
    const imports: Record<string, unknown> = {
      '@/lib/checkPermission': { checkAuth: async () => ({ authenticated: false, session: null }) },
      '@/lib/prisma': { prisma: denied },
      'next/navigation': { redirect: () => { throw Error('denied'); } },
    };
    if (component === 'layout') {
      for (const id of ['@/components/Sidebar', '@/components/PermissionSync', '@/providers/session-provider', '@/components/providers', '@/components/NotificationBellWrapper', '@/components/integrations/WhatsAppStatusBanner']) imports[id] = {};
    }
    const loaded = loadServerModule<{ default: (props: { children: null }) => Promise<unknown> }>(
      new URL(`../src/app/(app)/${component}.tsx`, import.meta.url), imports);
    await assert.rejects(loaded.default({ children: null }), /denied/);
  });
}

test('Dashboard rejects a changed tenant context before querying data', async () => {
  const page = loadServerModule<{ default: () => Promise<unknown> }>(
    new URL('../src/app/(app)/dashboard/page.tsx', import.meta.url), {
      '@/lib/checkPermission': {
        checkAuth: async () => ({ authenticated: true, session: { user: { id: 'u', organizationId: 'a' } } }),
        checkPermission: async () => ({ allowed: true, session: { user: { id: 'u', organizationId: 'b' } } }),
      },
      '@/lib/prisma': { prisma: new Proxy({}, { get() { throw Error('Unexpected query'); } }) },
      'next/navigation': { redirect: () => { throw Error('denied'); } },
    });
  await assert.rejects(page.default(), /denied/);
});
