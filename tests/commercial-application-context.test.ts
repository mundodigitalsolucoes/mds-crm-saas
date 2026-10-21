import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerModule } from './helpers/load-server-module';
import { resolveCommercialEntitlements } from '../src/lib/entitlements/resolver';
const available = ['atendimento', 'vendas', 'marketing'];
for (let mask = 1; mask < 8; mask++) for (const role of ['owner', 'admin', 'user']) for (const tenant of ['a', 'b']) {
  test(`authenticated contract ${mask}, ${role}, tenant ${tenant}`, async () => {
    const modules = available.filter((_, i) => mask & (1 << i));
    const session = { user: { id: 'user-' + tenant, organizationId: tenant, role } };
    const { getApplicationContext } = loadServerModule<{ getApplicationContext: () => Promise<{ modules: string[]; views: Record<string, boolean>; mode: string; organizationId: string }> }>(new URL('../src/lib/authorization/application-context.ts', import.meta.url), {
      '../checkPermission': {
        checkAuth: async () => ({ authenticated: true, session }),
        checkPermission: async (resource: string) => ({ session, allowed: role !== 'user' || resource !== 'leads' }),
      },
      '../entitlements/organization': { getOrganizationEntitlements: async (id: string) => {
        assert.equal(id, tenant);
        return { ok: true, entitlements: resolveCommercialEntitlements({ id, plan: 'legacy-MDS', features: JSON.stringify(modules) }) };
      } },
    });
    const context = await getApplicationContext();
    assert.deepEqual([...context.modules].sort(), [...modules].sort());
    assert.equal(context.views.leads, role !== 'user');
    assert.equal(context.organizationId, tenant);
    assert.equal(context.mode, 'observe_only');
  });
}
for (const failure of ['inactive', 'missing-contract', 'changed-tenant']) {
  test(`context fails closed: ${failure}`, async () => {
    const session = { user: { id: 'u', organizationId: 'a' } };
    const { getApplicationContext } = loadServerModule<{ getApplicationContext: () => Promise<unknown> }>(new URL('../src/lib/authorization/application-context.ts', import.meta.url), {
      '../checkPermission': {
        checkAuth: async () => ({ authenticated: failure !== 'inactive', session }),
        checkPermission: async () => ({ allowed: true, session: { user: { id: 'u', organizationId: 'b' } } }),
      },
      '../entitlements/organization': { getOrganizationEntitlements: async () => failure === 'changed-tenant' ? ({ ok: true, entitlements: { modules: ['vendas'] } }) : ({ ok: false }) },
    });
    assert.equal(await getApplicationContext(), null);
  });
}
