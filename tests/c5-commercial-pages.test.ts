import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerModule } from './helpers/load-server-module';
import { createModuleAuthorizer, type ModuleAccessRequest, type AuthorizationUser } from '../src/lib/authorization/authorize';
import { authorizationEffect } from '../src/lib/authorization/policy';

for (let mask = 1; mask < 8; mask++) for (const whiteLabel of [false, true]) {
  test(`C5 real layouts, existing engine, isolated modes: ${mask}/${whiteLabel}`, async () => {
    const modules = ['atendimento', 'vendas', 'marketing'].filter((_, i) => mask & (1 << i));
    const user: AuthorizationUser = { id: 'u', role: 'owner', organizationId: 'a', deletedAt: null, permissions: '{}', organization: {
      id: 'a', deletedAt: null, plan: 'enterprise', planStatus: 'active', trialEndsAt: null, maxProjects: 10,
      features: JSON.stringify([...modules, ...(whiteLabel ? ['white_label'] : [])]),
    } };
    const authorize = createModuleAuthorizer({ session: async () => ({ user: { id: 'u', organizationId: 'a' } }), readUser: async () => user });
    for (const mode of ['observe_only', 'enforce'] as const) {
      const guard = loadServerModule<{ checkModulePage: (request: ModuleAccessRequest) => Promise<void> }>(new URL('../src/lib/authorization/page.ts', import.meta.url), {
        './server': { evaluateModuleAccess: async (request: ModuleAccessRequest) => authorizationEffect(await authorize(request), mode) },
        './guards': { recordAuthorizationObservation: () => {} },
        'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); }, redirect: () => { throw Error('LOGIN'); } },
      });
      for (const [path, module] of [['projects', 'marketing'], ['leads', 'vendas'], ['kanban', 'vendas'], ['atendimento', 'atendimento'], ['settings/atendimento', 'atendimento']]) {
        const layout = loadServerModule<{ default: (props: { children: string }) => Promise<unknown> }>(new URL(`../src/app/(app)/${path}/layout.tsx`, import.meta.url), { '@/lib/authorization/page': guard });
        if (mode === 'enforce' && !modules.includes(module)) await assert.rejects(layout.default({ children: 'fixture' }), /NOT_FOUND/);
        else await assert.doesNotReject(layout.default({ children: 'fixture' }));
      }
    }
  });
}

test('C5 legacy unknown identifiers differ between module and channel compatibility policies', async () => {
  const { resolveCommercialEntitlements } = await import('../src/lib/entitlements/resolver');
  const { evaluateCommercialChannelAccess } = await import('../src/lib/entitlements/channel-access');
  const snapshot = { id: 'fixture', plan: 'legacy', features: '["atendimento","site_widget","legacy_opaque"]' };
  assert.equal(resolveCommercialEntitlements(snapshot).module('atendimento').contracted, true);
  assert.equal(evaluateCommercialChannelAccess(snapshot, 'site_widget').reason, 'invalid_features');
});
