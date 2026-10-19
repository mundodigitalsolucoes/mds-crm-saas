import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadServerModule } from './helpers/load-server-module';
import { parsePermissions, hasPermission } from '../src/lib/permissions';

test('provider lifecycle and legacy operational guards remain unchanged from the original authorization baseline', () => {
  const diff = execFileSync('git', ['diff', 'f93c3435fff316a548255993d749ef545c9c7670', '--',
    'src/app/(app)/atendimento', ':(exclude)src/app/(app)/atendimento/layout.tsx',
    'src/app/(app)/settings/atendimento', ':(exclude)src/app/(app)/settings/atendimento/layout.tsx', 'src/app/api/atendimento',
    ':(exclude)src/app/api/atendimento/equipes/route.ts',
    ':(exclude)src/app/api/atendimento/inboxes/route.ts',
    ':(exclude)src/app/api/atendimento/agentes/route.ts',
    ':(exclude)src/app/api/atendimento/agentes/sync/route.ts',
    ':(exclude)src/app/api/atendimento/equipes/[teamId]/route.ts',
    ':(exclude)src/app/api/atendimento/equipes/[teamId]/members/route.ts',
    ':(exclude)src/app/api/atendimento/inboxes/[inboxId]/members/route.ts',
    ':(exclude)src/app/api/atendimento/session-diagnostics/route.ts',
    ':(exclude)src/app/api/atendimento/widget/route.ts',
    ':(exclude)src/app/api/atendimento/canais/connect/route.ts',
    ':(exclude)src/app/api/atendimento/canais/email/google/authorize/route.ts',
    ':(exclude)src/app/api/atendimento/canais/email/route.ts',
    ':(exclude)src/app/api/atendimento/canais/whatsapp-cloud/connect/route.ts',
    ':(exclude)src/app/api/atendimento/canais/whatsapp-cloud/delete/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/accounts/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/connect/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/callback/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/create-inbox/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/debug-business-pages/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/debug-pages/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/debug-token/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/exchange-token/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/select-account/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/subscribe-page/route.ts',
    ':(exclude)src/app/api/atendimento/instagram/sync-account/route.ts',
    ':(exclude)src/app/api/atendimento/widget/agents/route.ts',
    ':(exclude)src/app/api/atendimento/widget/provision/route.ts',
    'src/app/api/integrations', ':(exclude)src/app/api/integrations/chatwoot/credentials/route.ts',
    ':(exclude)src/app/api/integrations/evolution/qrcode/route.ts',
    'src/app/api/webhooks', ':(exclude)src/app/api/webhooks/whatsapp-cloud/route.ts',
    ':(exclude)src/app/api/webhooks/chatwoot/route.ts', 'src/lib/integrations', 'src/lib/atendimento',
    'src/lib/checkPermission.ts', 'src/lib/checkLimits.ts',
    'src/lib/chatwoot.ts', 'src/lib/permissions.ts',
    'src/app/(app)/leads/page.tsx', 'src/app/(app)/kanban/page.tsx', 'src/store/leadsStore.ts',
    'prisma'], { encoding: 'utf8' });
  // C03/C04 intentionally changed auth, middleware and dependency metadata after this historical baseline.
  // The Chatwoot credentials guard is separately tested by authorization-atendimento-sso.test.ts.
  // The four Atendimento endpoints above only switch to the observe-only commercial guard.
  // All other integration and provider files remain protected by this historical diff.
  assert.equal(diff, '');
});

test('existing Atendimento permission contract remains unchanged without calling providers', async () => {
  const session = { user: { id: 'fixture-user', organizationId: 'fixture-org', role: 'user' } };
  const legacy = loadServerModule<{ checkPermission: (module: string, action: string) => Promise<{ allowed: boolean }> }>(
    new URL('../src/lib/checkPermission.ts', import.meta.url), {
      'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} },
      '@/lib/permissions': { parsePermissions, hasPermission },
      '@/lib/prisma': { prisma: { user: { findUnique: async () => ({
        id: 'fixture-user', organizationId: 'fixture-org', role: 'user', permissions: '{}', deletedAt: null,
        organization: { deletedAt: null },
      }) } } },
    });
  assert.equal((await legacy.checkPermission('atendimento', 'view')).allowed, true);
  assert.equal((await legacy.checkPermission('atendimento', 'create')).allowed, false);
});


test('Vendas integration preserves Marketing, the existing authorization engine and the empty enforcement manifest', () => {
  const diff = execFileSync('git', ['diff', 'd9ac1fe1b8e8406489c2158e5c26186580544ef7', '--',
    'src/app/api/projects', 'src/app/(app)/projects', 'src/lib/authorization', ':(exclude)src/lib/authorization/channel-observation.ts',
    'src/lib/entitlements', ':(exclude)src/lib/entitlements/channel-access.ts', 'src/lib/plans', 'src/lib/validations',
    'src/app/api/tags', 'src/app/api/tasks', 'src/app/api/agenda'], { encoding: 'utf8' });
  assert.equal(diff, '');
});
