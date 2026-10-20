import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
    ':(exclude)src/app/api/atendimento/instagram/webhook/route.ts',
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
    ':(exclude)src/app/api/webhooks/chatwoot/route.ts',
    ':(exclude)src/app/api/webhooks/asaas/route.ts', 'src/lib/integrations', 'src/lib/atendimento',
    'src/lib/checkLimits.ts',
    ':(exclude)src/lib/atendimento/instagram-oauth-state.ts',
    ':(exclude)src/lib/atendimento/instagram-security-store.ts',
    'src/lib/chatwoot.ts', 'src/lib/permissions.ts',
    'src/app/(app)/leads/page.tsx', 'src/app/(app)/kanban/page.tsx', 'src/store/leadsStore.ts',
    'prisma', ':(exclude)prisma/schema.prisma',
    ':(exclude)prisma/migrations/20261020230000_instagram_security_storage/migration.sql'], { encoding: 'utf8' });
  // C03/C04 intentionally changed auth, middleware and dependency metadata after this historical baseline.
  // The Chatwoot credentials guard is separately tested by authorization-atendimento-sso.test.ts.
  // The four Atendimento endpoints above only switch to the observe-only commercial guard.
  // All other integration and provider files remain protected by this historical diff.
  assert.equal(diff, '');
});

test('legacy permission guard only refreshes the role from verified database membership', () => {
  const baseline = execFileSync('git', ['show', 'f93c3435fff316a548255993d749ef545c9c7670:src/lib/checkPermission.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/lib/checkPermission.ts', 'utf8');
  const addition = '  // Downstream role checks must use current membership, never a stale JWT role.\n  session.user.role = dbUser.role;\n';
  assert.ok(current.includes(addition));
  assert.equal(current.replace(addition, '').trimEnd(), baseline.trimEnd());
});

test('Asaas authentication fix does not change any commercial event processing', () => {
  const baseline = execFileSync('git', ['show', 'f93c3435fff316a548255993d749ef545c9c7670:src/app/api/webhooks/asaas/route.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/app/api/webhooks/asaas/route.ts', 'utf8');
  const processing = '    const body = await req.json()';
  assert.ok(current.includes(processing));
  assert.equal(current.slice(current.indexOf(processing)).trimEnd(), baseline.slice(baseline.indexOf(processing)).trimEnd());
});

test('approved local G4 storage is additive and preserves every existing Prisma model', () => {
  const baseline = execFileSync('git', ['show', 'f93c3435fff316a548255993d749ef545c9c7670:prisma/schema.prisma'], { encoding: 'utf8' });
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  // The user approved only these two security models and their inverse relations
  // for local migration review/testing. All existing model tokens remain pinned.
  const existing = schema
    .replace(/^\/\/ Isolated security storage[^\n]*\n/gm, '')
    .replace(/model Instagram(?:OAuthState|WebhookReceipt) \{[^}]*\}/g, '')
    .replace(/^\s*instagramOAuthStates\s+InstagramOAuthState\[\]\s*$/gm, '')
    .replace(/^\s*instagramWebhookReceipts\s+InstagramWebhookReceipt\[\]\s*$/gm, '');
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  assert.equal(normalize(existing), normalize(baseline));
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
