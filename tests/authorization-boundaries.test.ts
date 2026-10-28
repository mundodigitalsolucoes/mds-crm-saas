import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadServerModule } from './helpers/load-server-module';
import { parsePermissions, hasPermission } from '../src/lib/permissions';

test('provider lifecycle and legacy operational guards remain unchanged from the original authorization baseline', () => {
  const diff = execFileSync('git', ['diff', '7face2f24b7e171aa897abf72bea8f429692b2cf', '--',
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
    // Domain V1 changes only syncPlanLimits; its other functions remain pinned below.
    ':(exclude)src/lib/atendimento/instagram-oauth-state.ts',
    ':(exclude)src/lib/atendimento/instagram-security-store.ts',
    ':(exclude)src/lib/atendimento/widget-inbox-store.ts',
    // This additive SSO helper is pinned byte-for-byte to its approved commit below.
    ':(exclude)src/lib/integrations/chatwoot-sso-origin.ts',
    'src/lib/chatwoot.ts', ':(exclude)src/lib/integrations/chatwoot-provision.ts', // C5-04 permission parsing is pinned separately below.
    'src/app/(app)/leads/page.tsx', 'src/app/(app)/kanban/page.tsx', 'src/store/leadsStore.ts',
    'prisma', ':(exclude)prisma/schema.prisma',
    ':(exclude)prisma/migrations/20261020230000_instagram_security_storage/migration.sql',
    ':(exclude)prisma/migrations/20261020234500_widget_durable_operation/migration.sql'], { encoding: 'utf8' });
  // C03/C04 intentionally changed auth, middleware and dependency metadata after this historical baseline.
  // The Chatwoot credentials guard is separately tested by authorization-atendimento-sso.test.ts.
  // The four Atendimento endpoints above only switch to the observe-only commercial guard.
  // All other integration and provider files remain protected by this historical diff.
  assert.equal(diff, '');
  const approvedSsoHelper = execFileSync('git', ['show',
    '4ed43940e0b7f63d7a5ee14ae80981b20c146096:src/lib/integrations/chatwoot-sso-origin.ts',
  ], { encoding: 'utf8' });
  assert.equal(readFileSync('src/lib/integrations/chatwoot-sso-origin.ts', 'utf8'), approvedSsoHelper);
});

test('legacy permission guard only refreshes the role from verified database membership', () => {
  const baseline = execFileSync('git', ['show', '7face2f24b7e171aa897abf72bea8f429692b2cf:src/lib/checkPermission.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/lib/checkPermission.ts', 'utf8');
  const addition = '  // Downstream role checks must use current membership, never a stale JWT role.\n  session.user.role = dbUser.role;\n';
  assert.ok(current.includes(addition));
  assert.equal(current.replace(addition, '').trimEnd(), baseline.trimEnd());
});

test('Asaas authentication fix does not change any commercial event processing', () => {
  const baseline = execFileSync('git', ['show', '7face2f24b7e171aa897abf72bea8f429692b2cf:src/app/api/webhooks/asaas/route.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/app/api/webhooks/asaas/route.ts', 'utf8');
  const processing = '    const body = await req.json()';
  assert.ok(current.includes(processing));
  assert.equal(current.slice(current.indexOf(processing)).trimEnd(), baseline.slice(baseline.indexOf(processing)).trimEnd());
});

test('approved local G4 storage is additive and preserves every existing Prisma model', () => {
  const baseline = execFileSync('git', ['show', '7face2f24b7e171aa897abf72bea8f429692b2cf:prisma/schema.prisma'], { encoding: 'utf8' });
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  // The user approved only these two security models and their inverse relations
  // for local migration review/testing. All existing model tokens remain pinned.
  const existing = schema
    .replace(/^\/\/ Isolated security storage[^\n]*\n/gm, '')
    .replace(/^\/\/ One durable creation identity[^\n]*\n/gm, '')
    .replace(/model Instagram(?:OAuthState|WebhookReceipt) \{[^}]*\}/g, '')
    .replace(/model WidgetInboxOperation \{[^}]*\}/g, '')
    .replace(/^\s*widgetInboxOperation\s+WidgetInboxOperation\?\s*$/gm, '')
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
  const diff = execFileSync('git', ['diff', '98663c6d4a5c0b1a661f90966d6edc81a386a523', '--',
    'src/app/api/projects', 'src/app/(app)/projects', 'src/lib/authorization', ':(exclude)src/lib/authorization/channel-observation.ts',
    // Explicit C5-03/C5-04 additions; unchanged core functions are pinned separately below.
    ':(exclude)src/lib/authorization/authorize.ts', ':(exclude)src/lib/authorization/guards.ts',
    ':(exclude)src/lib/authorization/operation-data.ts', ':(exclude)src/lib/authorization/server.ts',
    // C1 adds a presentation adapter; all pre-existing engine files stay protected.
    ':(exclude)src/lib/authorization/application-context.ts',
    'src/lib/entitlements', ':(exclude)src/lib/entitlements/catalog.ts', ':(exclude)src/lib/entitlements/channel-access.ts', 'src/lib/plans', 'src/lib/validations',
    ':(exclude)src/lib/validations/branding.ts', ':(exclude)src/lib/validations/admin.ts', ':(exclude)src/lib/validations/index.ts',
    'src/app/api/tags', 'src/app/api/tasks',
    // Explicit C5 SECURITY authorization: only the two vulnerable Task handlers.
    ':(exclude)src/app/api/tasks/route.ts', ':(exclude)src/app/api/tasks/[[]id[]]/route.ts',
    // Current granular authorization includes exactly these two subtask routes; full deltas pinned below.
    ':(exclude)src/app/api/tasks/[[]id[]]/subtasks/route.ts',
    ':(exclude)src/app/api/tasks/[[]id[]]/subtasks/[[]subtaskId[]]/route.ts',
    'src/app/api/agenda'], { encoding: 'utf8' });
  assert.equal(diff, '');
});

test('Super Admin user schema export is the sole validation entrypoint change', () => {
  const original = execFileSync('git', ['show', '98663c6d4a5c0b1a661f90966d6edc81a386a523:src/lib/validations/index.ts'], { encoding: 'utf8' });
  const current = readFileSync(new URL('../src/lib/validations/index.ts', import.meta.url), 'utf8');
  assert.equal(current.replace('  adminUserCreateSchema,\n', ''), original);
});

// C4 and the scoped branding editor permit only their explicit optional fields;
// all other pre-existing validation stays byte-for-byte frozen.
test('C4 preserves existing admin validation except White-Label and validated branding', () => {
  const original = execFileSync('git', ['show', 'd626bff:src/lib/validations/admin.ts'], { encoding: 'utf8' });
  const current = readFileSync(new URL('../src/lib/validations/admin.ts', import.meta.url), 'utf8');
  assert.equal(current
    .replace("import { brandingUpdateSchema } from './branding';\n", '')
    .replace('  whiteLabel: z.boolean().optional(),\n', '')
    .replace('  branding: brandingUpdateSchema.optional(),\n', '')
    .replace(`export const adminUserCreateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(12).max(128),
  role: z.enum(['owner', 'admin', 'manager', 'user']),
}).strict();

`, '')
    .replace("  name: z.string().trim().min(2).max(255).optional(),\n  email: z.string().trim().toLowerCase().email().max(255).optional(),\n  role: z.enum(['owner', 'admin', 'manager', 'user'], {", "  role: z.enum(['owner', 'admin', 'manager', 'user'], {"), original);
});

test('C4 leaves the organization DELETE/provider lifecycle byte-for-byte unchanged', () => {
  const path = 'src/app/api/admin/organizations/[id]/route.ts';
  const original = execFileSync('git', ['show', `d626bff:${path}`], { encoding: 'utf8' });
  const current = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.equal(current.slice(current.indexOf('export async function DELETE')), original.slice(original.indexOf('export async function DELETE')));
});

test('C5-04 changes only the documented partial-permission recognition condition', () => {
  const original = execFileSync('git', ['show', 'a27316c:src/lib/permissions.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/lib/permissions.ts', 'utf8');
  const before = "if (typeof parsed === 'object' && parsed !== null && 'leads' in parsed) {";
  const after = "if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) &&\n      ('leads' in parsed || (Object.keys(parsed).some(key => ALL_MODULES.includes(key as PermissionModule)) &&\n        Object.values(parsed).every(value => value !== null && typeof value === 'object' && !Array.isArray(value) &&\n          Object.values(value).every(flag => typeof flag === 'boolean'))))) {";
  assert.ok(current.includes(after));
  assert.equal(current.replace(after, before), original);
});

test('C5 keeps every existing identity/subscription/tenant check and legacy guard body unchanged', async () => {
  const ts = await import('typescript');
  const before = execFileSync('git', ['show', 'a27316c:src/lib/authorization/authorize.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/lib/authorization/authorize.ts', 'utf8');
  const declaration = (text: string, name: string) => {
    const source = ts.createSourceFile('contract.ts', text, ts.ScriptTarget.Latest, true);
    return source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)?.getText(source);
  };
  for (const name of ['createModuleAuthorizer', 'createAdministrativeAuthorizer']) assert.equal(declaration(current, name), declaration(before, name));
  assert.equal(declaration(current, 'validPermissions'), declaration(before, 'validPermissions')!.replace("if (!('leads' in value)) return false;", "if (!Object.keys(value).some(key => ALL_MODULES.includes(key as PermissionModule))) return false;"));
  const guardBefore = execFileSync('git', ['show', 'a27316c:src/lib/authorization/guards.ts'], { encoding: 'utf8' });
  assert.ok(readFileSync('src/lib/authorization/guards.ts', 'utf8').startsWith(guardBefore.trimEnd()));
});

// Current scope permits additive commercial checks only; tenant checks, schemas and CRUD bodies stay identical.
test('C5 granular subtask batch preserves original handlers except the exact approved additive guard', () => {
  for (const [suffix, actions] of [['', ['view', 'edit']], ['/[subtaskId]', ['edit', 'delete']]] as const) {
    const path = `src/app/api/tasks/[id]/subtasks${suffix}/route.ts`;
    const original = execFileSync('git', ['show', `f0acc3e:${path}`], { encoding: 'utf8' });
    let expected = original.replace("import { checkPermission } from '@/lib/checkPermission';", "import { checkPermission } from '@/lib/checkPermission';\nimport { taskCommercialDenial } from '@/lib/authorization/guards';")
      .replace('select: { id: true },', 'select: { id: true, type: true, leadId: true, projectId: true },');
    const marker = "      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });\n    }";
    let cursor = 0;
    for (const action of actions) {
      const offset = expected.indexOf(marker, cursor);
      assert.ok(offset >= 0);
      const end = offset + marker.length;
      const addition = `\n\n    const commercialDenied = await taskCommercialDenial(session!, '${action}', task);\n    if (commercialDenied) return commercialDenied;`;
      expected = expected.slice(0, end) + addition + expected.slice(end);
      cursor = end + addition.length;
    }
    assert.equal(readFileSync(path, 'utf8'), expected);
  }
});

test('Lot2 server adapter changes only database/session binding and preserves default rules', () => {
  let expected = execFileSync('git', ['show', '786233c:src/lib/authorization/server.ts'], { encoding: 'utf8' });
  expected = "import type { Prisma } from '@prisma/client';\nimport type { TrustedSessionIdentity } from './authorize';\n" + expected;
  expected = expected.replace('export async function evaluateModuleAccess(request: ModuleAccessRequest) {', `/** Context is server-owned and used only after the caller authenticates/locks the actor. */
export interface TransactionAuthorizationContext {
  session: TrustedSessionIdentity;
  client: Prisma.TransactionClient;
}

export async function evaluateModuleAccess(request: ModuleAccessRequest, context?: TransactionAuthorizationContext) {
  const database = context?.client ?? prisma;`)
    .replace('const session = await getServerSession(authOptions);', 'const session = context?.session ?? await getServerSession(authOptions);')
    .replace('      return session;', '      return session ?? null;')
    .replace('readUser: (id) => prisma.user.findUnique', 'readUser: (id) => database.user.findUnique')
    .replace('return await prisma.marketingProject.count', 'return await database.marketingProject.count');
  assert.equal(readFileSync('src/lib/authorization/server.ts', 'utf8'), expected);
});

// Domain V1 adds one capability; every existing identifier remains byte-for-byte pinned.
test('custom domain catalog addition does not modify any existing commercial contract', () => {
  const previous = execFileSync('git', ['show', '1ea0a216792cfb7b1f850c318f6851f7de87e249:src/lib/entitlements/catalog.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/lib/entitlements/catalog.ts', 'utf8');
  const addition = "  custom_domain: feature('capability', 'available', 'Domínio próprio', 'Hostname exclusivo, com posse e HTTPS verificados; não habilita módulos nem White-Label.'),\n";
  assert.ok(current.includes(addition));
  assert.equal(current.replace(addition, ''), previous);
});

test('domain invalidation preserves every legacy limit rule outside plan synchronization', () => {
  const previous = execFileSync('git', ['show', '1ea0a216792cfb7b1f850c318f6851f7de87e249:src/lib/checkLimits.ts'], { encoding: 'utf8' });
  const current = readFileSync('src/lib/checkLimits.ts', 'utf8').replace("import { domainCapabilityPatch, domainCapabilityAudit } from './domains/commercial-change';\n", '');
  const stripSync = (value: string) => value.replace(/export async function syncPlanLimits\([\s\S]*?(?=export async function getOrganizationUsage)/, '');
  assert.equal(stripSync(current), stripSync(previous));
});

// The security fix changes only webhook reconciliation in the shared preamble;
// URL normalization, subscriptions, error sanitization and the Rails strategy stay pinned.
test('Chatwoot onboarding preserves unrelated helpers and never adopts the legacy Rails strategy', () => {
  const path = 'src/lib/integrations/chatwoot-provision.ts';
  const original = execFileSync('git', ['show', 'c4d0db7:' + path], {encoding:'utf8'});
  const current = readFileSync(path, 'utf8');
  const preamble = (source: string) => source.slice(source.indexOf('function normalizeBaseUrl'), source.indexOf('function parseStoredChatwootData'))
    .replace(/function normalizeChatwootWebhooksResponse[\s\S]*?(?=function resolveCrmPublicUrl)/, '')
    .replace(/export async function ensureChatwootWebhookForAccount[\s\S]*/, '');
  assert.equal(preamble(current), preamble(original));
  assert.doesNotMatch(current, /execSync|docker exec|rails runner|connectedAccount\.upsert/);
  assert.equal(readFileSync('src/lib/integrations/chatwootOnboarding.ts','utf8'), execFileSync('git',['show','77f4eeb:src/lib/integrations/chatwootOnboarding.ts'],{encoding:'utf8'}));
});
