import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadServerModule } from './helpers/load-server-module';
import { resolveCommercialEntitlements } from '../src/lib/entitlements/resolver';
import * as brandingValues from '../src/lib/branding-values';
import type { ApplicationContext } from '../src/lib/authorization/application-context';
const modules = ['atendimento', 'vendas', 'marketing'];
const resources = ['atendimento', 'leads', 'kanban', 'agenda', 'tasks', 'goals', 'projects', 'os', 'reports', 'users', 'integrations'];
for (let mask = 1; mask < 8; mask++) for (const role of ['owner', 'admin', 'user']) for (const tenant of ['a', 'b']) {
  test(`actual Sidebar markup ${mask}/${role}/${tenant}`, () => {
    const contracted = modules.filter((_, i) => mask & (1 << i));
    const entitlements = resolveCommercialEntitlements({ id: tenant, plan: 'legacy-MDS', features: JSON.stringify(contracted) });
    const access: ApplicationContext = {
      userId: role + tenant, organizationId: tenant, modules: entitlements.modules, mode: 'observe_only',
      views: Object.fromEntries(resources.map(resource => [resource, role !== 'user' || resource !== (tenant === 'a' ? 'leads' : 'tasks')])),
    };
    const { default: Sidebar } = loadServerModule<{ default: React.ComponentType<{ access: ApplicationContext }> }>(new URL('../src/components/Sidebar.tsx', import.meta.url), {
      '@/lib/branding-values': brandingValues,
      react: { ...React, useState: (initial: unknown) => React.useState(typeof initial === 'object' ? { atendimento: true, vendas: true, marketing: true, configuracoes: true, ajuda: true } : initial) },
      'next/link': { default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', props) },
      'next/navigation': { usePathname: () => '/dashboard' },
      'next-auth/react': { useSession: () => ({ data: { user: { id: access.userId, organizationId: tenant, name: 'Fixture', role } } }), signOut: () => {} },
      'next/dynamic': { default: () => () => null },
      '@/hooks/usePermission': { usePermission: () => ({ canAccess: (resource: string) => access.views[resource as keyof typeof access.views], isAdmin: role !== 'user', isLoading: false }) },
    });
    const html = renderToStaticMarkup(React.createElement(Sidebar, { access }));
    for (const path of ['/dashboard', '/settings/account', '/help']) assert.ok(html.includes(`href="${path}"`));
    const expected = {
      '/atendimento': contracted.includes('atendimento'),
      '/settings/atendimento': contracted.includes('atendimento'),
      '/leads': contracted.includes('vendas') && (role !== 'user' || tenant === 'b'),
      '/kanban': contracted.includes('vendas'),
      '/projects': contracted.includes('marketing'),
      '/tasks': contracted.includes('marketing') && (role !== 'user' || tenant !== 'b'),
      '/follow-ups': contracted.includes('vendas') && role !== 'user',
      '/os': contracted.includes('marketing'),
    };
    for (const [path, visible] of Object.entries(expected)) assert.equal(html.includes(`href="${path}"`), visible, path);
  });
}
