import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadServerModule } from './helpers/load-server-module';
import { parsePermissions, hasPermission } from '../src/lib/permissions';

test('CORE, Atendimento, providers, webhooks, login and the old permission/limit helpers are unchanged from the reference', () => {
  const diff = execFileSync('git', ['diff', 'f93c3435fff316a548255993d749ef545c9c7670', '--',
    'src/app/(app)/atendimento', 'src/app/(app)/settings/atendimento', 'src/app/api/atendimento',
    'src/app/api/integrations', 'src/app/api/webhooks', 'src/lib/integrations', 'src/lib/atendimento',
    'src/lib/auth.ts', 'src/lib/admin-auth.ts', 'src/lib/checkPermission.ts', 'src/lib/checkLimits.ts',
    'src/app/api/auth', 'src/app/auth', 'src/app/api/leads', 'src/app/api/kanban',
    'src/app/(app)/leads', 'src/app/(app)/kanban',
    'middleware.ts', 'prisma', 'package.json', 'package-lock.json'], { encoding: 'utf8' });
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
