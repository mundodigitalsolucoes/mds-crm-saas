import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerModule } from './helpers/load-server-module';
import { resolveCommercialEntitlements } from '../src/lib/entitlements/resolver';
for (let mask = 1; mask < 8; mask++) for (const role of ['owner', 'user']) {
  test(`Dashboard selects queries before execution ${mask}/${role}`, async () => {
    const calls: string[] = [];
    const modules = ['atendimento', 'vendas', 'marketing'].filter((_, i) => mask & (1 << i));
    const session = { user: { id: 'u', organizationId: 'a', role } };
    const model = (name: string) => ({
      count: async () => { calls.push(name); return 1; },
      findMany: async () => { calls.push(name); return []; },
      findFirst: async () => ({ plan: 'trial' }),
    });
    const { default: page } = loadServerModule<{ default: () => Promise<unknown> }>(new URL('../src/app/(app)/dashboard/page.tsx', import.meta.url), {
      '@/lib/checkPermission': {
        checkAuth: async () => ({ authenticated: true, session }),
        checkPermission: async (resource: string) => ({ allowed: role === 'owner' || resource !== 'leads', session }),
      },
      '@/lib/entitlements/organization': { getOrganizationEntitlements: async () => ({ ok: true,
        entitlements: resolveCommercialEntitlements({ id: 'a', plan: 'legacy-MDS', features: JSON.stringify(modules) }) }) },
      '@/lib/prisma': { prisma: { lead: model('leads'), marketingProject: model('projects'), task: model('tasks'), serviceOrder: model('os'), user: model('users'), organization: model('org') } },
      'next/navigation': { redirect: () => { throw Error('redirect'); } },
    });
    await page();
    assert.equal(calls.includes('leads'), modules.includes('vendas') && role === 'owner');
    assert.equal(calls.includes('projects'), modules.includes('marketing'));
    assert.equal(calls.includes('os'), modules.includes('marketing'));
    assert.equal(calls.includes('tasks'), modules.includes('vendas') || modules.includes('marketing'));
    assert.ok(calls.includes('users'), 'Shared member usage retains its operational permission');
  });
}
