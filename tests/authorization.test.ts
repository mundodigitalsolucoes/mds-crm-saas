import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModuleAuthorizer, createAdministrativeAuthorizer, type AuthorizationUser, type ModuleAccessRequest } from '../src/lib/authorization/authorize';
import { authorizationEffect, modeForOrganization } from '../src/lib/authorization/policy';
import { getDefaultPermissions } from '../src/lib/permissions';
import { loadServerModule } from './helpers/load-server-module';

const request: ModuleAccessRequest = { module: 'marketing', permission: 'projects', action: 'view' };
function user(): AuthorizationUser {
  return {
    id: 'fixture-user', organizationId: 'fixture-org', deletedAt: null, role: 'owner', permissions: '{}',
    organization: { id: 'fixture-org', deletedAt: null, plan: 'fixture-plan', planStatus: 'active', trialEndsAt: null, features: '["marketing"]', maxProjects: 2 },
  };
}
const session = () => Promise.resolve({ user: { id: 'fixture-user', organizationId: 'fixture-org', role: 'owner', features: '["marketing"]' } });
const evaluate = (record: AuthorizationUser | null) => createModuleAuthorizer({ session, readUser: async () => record });

test('authorization: no session never reads tenant data', async () => {
  const authorize = createModuleAuthorizer({ session: async () => null, readUser: async () => assert.fail('must not read') });
  assert.deepEqual(await authorize(request), { allowed: false, reason: 'unauthenticated', status: 401 });
});

test('authorization: missing organization and mismatched relation are generic invalid organization', async () => {
  for (const organization of [null, { ...user().organization!, id: 'another-org' }]) {
    const result = await evaluate({ ...user(), organization })(request);
    assert.equal(result.reason, 'invalid_organization');
    assert.equal('context' in result, false);
  }
});

test('authorization: removed, missing and mismatched users are inactive members', async () => {
  for (const record of [null, { ...user(), deletedAt: new Date() }, { ...user(), id: 'another-user' }]) {
    assert.equal((await evaluate(record)(request)).reason, 'inactive_membership');
  }
});

test('authorization: stale session from another organization cannot cross the membership boundary', async () => {
  const record = user(); record.organizationId = 'another-org'; record.organization!.id = 'another-org';
  const result = await evaluate(record)(request);
  assert.equal(result.reason, 'invalid_organization');
  assert.equal(JSON.stringify(result).includes('another-org'), false);
});

test('authorization: deleted organization is invalid', async () => {
  const record = user(); record.organization!.deletedAt = new Date();
  assert.equal((await evaluate(record)(request)).reason, 'invalid_organization');
});

test('authorization: owner and admin cannot bypass missing commercial modules', async () => {
  for (const role of ['owner', 'admin']) {
    const record = user(); record.role = role; record.organization!.features = '["vendas"]';
    assert.equal((await evaluate(record)(request)).reason, 'module_not_contracted');
  }
});

test('authorization: valid commercial module does not grant a missing individual permission', async () => {
  const record = user(); record.role = 'user';
  const permissions = getDefaultPermissions('user'); permissions.projects.view = false;
  record.permissions = JSON.stringify(permissions);
  assert.equal((await evaluate(record)(request)).reason, 'insufficient_permission');
});

test('authorization: valid module and permission give a tenant-bound internal decision', async () => {
  const record = user(); record.role = 'user';
  assert.deepEqual(await evaluate(record)(request), {
    allowed: true, reason: 'allowed', status: 200,
    context: { userId: 'fixture-user', organizationId: 'fixture-org' },
  });
});

test('authorization: fresh permissions and role are re-read during an active session', async () => {
  const record = user(); const reads: string[] = [];
  const authorize = createModuleAuthorizer({ session, readUser: async (id) => { reads.push(id); return record; } });
  assert.equal((await authorize({ ...request, action: 'edit' })).allowed, true);
  record.role = 'user'; record.permissions = JSON.stringify(getDefaultPermissions('user'));
  assert.equal((await authorize({ ...request, action: 'edit' })).reason, 'insufficient_permission');
  assert.deepEqual(reads, ['fixture-user', 'fixture-user']);
});

test('authorization: independent tenants and calls do not share cached rights', async () => {
  const a = user(), b = user(); b.id = 'second-user'; b.organizationId = 'second-org';
  b.organization!.id = 'second-org'; b.organization!.features = '["vendas"]';
  const authorizeB = createModuleAuthorizer({ session: async () => ({ user: { id: b.id, organizationId: b.organizationId } }), readUser: async () => b });
  const [first, second] = await Promise.all([evaluate(a)(request), authorizeB(request)]);
  assert.equal(first.allowed, true); assert.equal(second.reason, 'module_not_contracted');
});

test('authorization: inactive and unknown subscriptions fail closed', async () => {
  for (const status of ['cancelled', 'past_due', 'trial_expired', 'unknown']) {
    const record = user(); record.organization!.planStatus = status;
    assert.equal((await evaluate(record)(request)).reason, 'inactive_subscription');
  }
});

test('authorization: expired/missing trial deadline denies; valid future trial is evaluated', async () => {
  const now = new Date('2026-10-18T12:00:00Z');
  for (const deadline of [null, new Date('2026-10-17T12:00:00Z'), new Date('invalid')]) {
    const record = user(); record.organization!.plan = 'trial'; record.organization!.trialEndsAt = deadline;
    const authorize = createModuleAuthorizer({ session, readUser: async () => record, now: () => now });
    assert.equal((await authorize(request)).reason, 'inactive_subscription');
  }
  const record = user(); record.organization!.plan = 'trial'; record.organization!.trialEndsAt = new Date('2026-10-19T12:00:00Z');
  assert.equal((await createModuleAuthorizer({ session, readUser: async () => record, now: () => now })(request)).allowed, true);
});

test('authorization: future modules remain unavailable, even if explicitly listed', async () => {
  const record = user(); record.organization!.features = '["financeiro","agentes_ia"]';
  for (const moduleKey of ['financeiro', 'agentes_ia'] as const) {
    assert.equal((await evaluate(record)({ ...request, module: moduleKey })).reason, 'module_unavailable');
  }
});

test('authorization: empty, invalid and unknown legacy features are not universal grants', async () => {
  for (const features of ['[]', '{', '["unknown"]', '']) {
    const record = user(); record.organization!.features = features;
    assert.equal((await evaluate(record)(request)).reason, 'module_not_contracted');
  }
});

test('authorization: custom plan name and divergence never cause a Plan.features fallback', async () => {
  const record = user(); record.organization!.plan = 'enterprise'; record.organization!.features = '["vendas"]';
  assert.equal((await evaluate(record)(request)).reason, 'module_not_contracted');
});

test('authorization: malformed permissions, unknown roles and wrong module-permission pair cannot grant rights', async () => {
  for (const permissions of ['{', 'null', '{"projects":{"view":true}}', '{"leads":true}', '{"leads":{"view":"true"}}']) {
    assert.equal((await evaluate({ ...user(), permissions })(request)).reason, 'insufficient_permission');
  }
  assert.equal((await evaluate({ ...user(), role: 'superadmin' })(request)).reason, 'insufficient_permission');
  assert.equal((await evaluate(user())({ ...request, permission: 'users' })).reason, 'insufficient_permission');
});

test('authorization: data/session/rule read failures never yield an allowed decision', async () => {
  for (const part of ['session', 'user', 'rule']) {
    const authorize = createModuleAuthorizer({
      session: part === 'session' ? async () => { throw new Error('private-session'); } : session,
      readUser: async () => { if (part === 'user') throw new Error('private-db'); return user(); },
      additionalRules: async () => { if (part === 'rule') throw new Error('private-rule'); return true; },
    });
    assert.deepEqual(await authorize(request), { allowed: false, reason: 'infrastructure_error', status: 503 });
  }
});

test('authorization: additional resource/limit rules must allow the requested operation', async () => {
  const authorize = createModuleAuthorizer({ session, readUser: async () => user(), additionalRules: async () => false });
  assert.equal((await authorize(request)).reason, 'additional_rule_denied');
});

test('policy: no tenant, global environment setting or client flag enables enforcement', () => {
  for (const id of [undefined, 'fixture-org', '*', 'enforce']) assert.equal(modeForOrganization(id), 'observe_only');
  const decision = { allowed: false, reason: 'module_not_contracted', status: 403 } as const;
  assert.equal(authorizationEffect(decision, 'observe_only').block, false);
  assert.equal(authorizationEffect(decision, 'observe_only').decision.allowed, false);
  assert.equal(authorizationEffect(decision, 'enforce').block, true);
});

test('administration: explicit verified Super Admin authority is scoped, never a tenant bypass', async () => {
  const authorize = createAdministrativeAuthorizer({
    session: async () => ({ id: 'fixture-admin', role: 'superadmin' }),
    readAdmin: async (id) => ({ id }),
    readOrganization: async (id) => id === 'fixture-org' ? { id, deletedAt: null } : null,
  });
  assert.equal((await authorize({ kind: 'plans' })).allowed, true);
  assert.equal((await authorize({ kind: 'organization', organizationId: 'fixture-org' })).allowed, true);
  assert.equal((await authorize({ kind: 'organization', organizationId: 'another-org' })).allowed, false);
  for (const role of ['owner', 'admin', 'user']) {
    const unprivileged = createAdministrativeAuthorizer({
      session: async () => ({ id: 'fixture-admin', role }), readAdmin: async () => assert.fail(), readOrganization: async () => assert.fail(),
    });
    assert.equal((await unprivileged({ kind: 'plans' })).allowed, false);
  }
});

test('server adapter: exact fresh user selection, session failure observation and strict project limit reads', async () => {
  const record = user(); let count = 2; let unavailable = false; let sessionUnavailable = false;
  const server = loadServerModule<{ evaluateModuleAccess: (request: ModuleAccessRequest) => Promise<ReturnType<typeof authorizationEffect>> }>(
    new URL('../src/lib/authorization/server.ts', import.meta.url), {
      'next-auth': { getServerSession: async () => { if (sessionUnavailable) throw new Error(); return session(); } },
      '../auth': { authOptions: {} }, '../admin-auth': { verifyAdminToken: async () => null },
      './authorize': { createModuleAuthorizer, createAdministrativeAuthorizer },
      './policy': { authorizationEffect, modeForOrganization },
      '../prisma': { prisma: {
        user: { findUnique: async (args: { where: { id: string }; select: { organization: { select: Record<string, boolean> } } }) => {
          assert.equal(args.where.id, 'fixture-user'); assert.equal(args.select.organization.select.features, true); return record;
        } },
        marketingProject: { count: async (args: { where: { organizationId: string } }) => {
          assert.equal(args.where.organizationId, 'fixture-org'); if (unavailable) throw new Error(); return count;
        } },
      } },
    });
  assert.equal((await server.evaluateModuleAccess({ ...request, action: 'create' })).decision.reason, 'additional_rule_denied');
  count = 0;
  assert.equal((await server.evaluateModuleAccess({ ...request, action: 'create' })).decision.allowed, true);
  unavailable = true;
  assert.equal((await server.evaluateModuleAccess({ ...request, action: 'create' })).decision.reason, 'infrastructure_error');
  sessionUnavailable = true;
  const result = await server.evaluateModuleAccess(request);
  assert.equal(result.decision.reason, 'infrastructure_error'); assert.equal(result.mode, 'observe_only');
});
