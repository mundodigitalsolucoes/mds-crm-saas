import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadServerModule } from './helpers/load-server-module';
import * as values from '../src/lib/branding-values';
import { resolveCommercialEntitlements } from '../src/lib/entitlements/resolver';
import { brandingUpdateSchema } from '../src/lib/validations/branding';
import type { ApplicationContext } from '../src/lib/authorization/application-context';

for (let mask = 1; mask < 8; mask++) for (const whiteLabel of [false, true]) for (const role of ['owner', 'admin', 'user']) for (const tenant of ['a', 'b']) {
  test(`branding real helper/Sidebar ${mask}/${whiteLabel}/${role}/${tenant}`, async () => {
    const modules = ['atendimento', 'vendas', 'marketing'].filter((_, i) => mask & (1 << i));
    const snapshot = { id: tenant, plan: 'enterprise', deletedAt: null, features: JSON.stringify([...modules, ...(whiteLabel ? ['white_label'] : [])]),
      name: 'Customer ' + tenant, logo: `https://${tenant}.example.invalid/logo.png`, favicon: `https://${tenant}.example.invalid/favicon.ico`, primaryColor: tenant === 'a' ? '#123456' : '#654321', secondaryColor: '#abcdef' };
    const { getOrgBranding } = loadServerModule<{ getOrgBranding: (id: string) => Promise<values.OrgBranding> }>(new URL('../src/lib/branding.ts', import.meta.url), {
      '@/lib/prisma': { prisma: { organization: { findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => {
        assert.equal(where.id, tenant); assert.equal(where.deletedAt, null); return snapshot;
      } } } },
    });
    const brand = await getOrgBranding(tenant);
    assert.equal(brand.name, whiteLabel ? snapshot.name : values.DEFAULT_BRANDING.name);
    assert.equal(brand.favicon, whiteLabel ? snapshot.favicon : values.DEFAULT_BRANDING.favicon);
    const access: ApplicationContext = { userId: role + tenant, organizationId: tenant, mode: 'observe_only', modules: resolveCommercialEntitlements(snapshot).modules, views: { atendimento: true, leads: true, tasks: true, projects: true, os: true } };
    const { default: Sidebar } = loadServerModule<{ default: React.ComponentType<{ access: ApplicationContext; branding: values.OrgBranding }> }>(new URL('../src/components/Sidebar.tsx', import.meta.url), {
      '@/lib/branding-values': values,
      'next/link': { default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', props) },
      'next/navigation': { usePathname: () => '/dashboard' },
      'next-auth/react': { useSession: () => ({ data: { user: { id: access.userId, organizationId: tenant, role } } }), signOut: () => {} },
      'next/dynamic': { default: () => () => null },
      '@/hooks/usePermission': { usePermission: () => ({ canAccess: () => true, isAdmin: role !== 'user', isLoading: false }) },
    });
    const html = renderToStaticMarkup(React.createElement(Sidebar, { access, branding: brand }));
    assert.ok(html.includes(`src="${whiteLabel ? snapshot.logo : values.DEFAULT_BRANDING.logo}"`));
    assert.ok(html.includes(`alt="${brand.name}"`));
    assert.ok(html.includes(`background-color:${brand.primaryColor}`));
    assert.ok(!html.includes(`https://${tenant === 'a' ? 'b' : 'a'}.example.invalid`));
  });
}

test('legacy unsafe assets/colors cannot escape CSS or HTML; schema rejects commercial fields', () => {
  for (const asset of ['javascript:alert(1)', 'data:image/svg+xml,x', '//evil.invalid/x', 'https://user:pass@example.invalid/x', '/\\evil.invalid/x']) assert.equal(values.safeBrandAsset(asset), null);
  const safe = values.brandingValues({ primaryColor: '</style><script>x</script>', logo: 'javascript:x' });
  assert.equal(safe.primaryColor, values.DEFAULT_BRANDING.primaryColor);
  assert.ok(!values.brandingCssVars(safe).includes('<'));
  assert.equal(brandingUpdateSchema.safeParse({ features: '["white_label"]' }).success, false);
  assert.equal(brandingUpdateSchema.safeParse({ whiteLabel: true }).success, false);
  assert.equal(brandingUpdateSchema.safeParse({ primaryColor: '#112233', logo: '/images/logo.png' }).success, true);
});
