import { NextRequest } from 'next/server';
import * as validation from '../../src/lib/validations';
import { createModuleAuthorizer, type AuthorizationUser, type ModuleAccessRequest, type AuthorizationDecision } from '../../src/lib/authorization/authorize';
import { authorizationEffect, type AuthorizationMode } from '../../src/lib/authorization/policy';
import { hasPermission, parsePermissions } from '../../src/lib/permissions';
import { loadServerModule } from './load-server-module';

export const ORG = 'fixture-org';
export const OTHER_ORG = 'other-org';
export const OWN = '10000000-0000-4000-8000-000000000001';
export const FOREIGN = '10000000-0000-4000-8000-000000000002';
export const USER = '20000000-0000-4000-8000-000000000001';
export const FOREIGN_USER = '20000000-0000-4000-8000-000000000002';
export const TAG = '30000000-0000-4000-8000-000000000001';
export const FOREIGN_TAG = '30000000-0000-4000-8000-000000000002';
export const OWN_STAGE = 'own_custom_stage';
export const FOREIGN_STAGE = 'foreign_custom_stage';
export const OPERATIONS = [
  ['leads', 'GET', 'leads', 'view'], ['leads', 'POST', 'leads', 'create'],
  ['lead', 'GET', 'leads', 'view'], ['lead', 'PUT', 'leads', 'edit'], ['lead', 'DELETE', 'leads', 'delete'],
  ['stage', 'PATCH', 'leads', 'edit'], ['tags', 'GET', 'leads', 'view'],
  ['tags', 'POST', 'leads', 'edit'], ['tags', 'DELETE', 'leads', 'edit'],
  ['bulk-update', 'POST', 'leads', 'edit'], ['bulk-delete', 'POST', 'leads', 'delete'],
  ['import', 'POST', 'leads', 'create'], ['stages', 'GET', 'kanban', 'view'],
  ['stages', 'POST', 'kanban', 'create'], ['stage-item', 'PUT', 'kanban', 'edit'],
  ['stage-item', 'DELETE', 'kanban', 'delete'],
] as const;
export type Route = typeof OPERATIONS[number][0];
type Args = { where?: Record<string, any>; data?: any; [key: string]: any };
type Row = Record<string, any>;
type Handlers = Record<string, (req: NextRequest, context: { params: Promise<{ id: string; key: string }> }) => Promise<Response>>;

export function salesFixture(mode: AuthorizationMode = 'observe_only') {
  const actor: AuthorizationUser = {
    id: USER, organizationId: ORG, deletedAt: null, role: 'owner', permissions: '{}',
    organization: { id: ORG, deletedAt: null, plan: 'fixture-plan', planStatus: 'active', trialEndsAt: null, features: '["vendas"]', maxProjects: 5 },
  };
  const state = { session: { user: { id: USER, organizationId: ORG, role: 'owner' } } as { user: { id: string; organizationId: string; role: string } } | null,
    user: actor as AuthorizationUser | null, newEngineUnavailable: false, relationUnavailable: false, legacyPlanActive: true, legacyLimitAllowed: true };
  const records: Record<string, Row[]> = {
    lead: [
      { id: OWN, organizationId: ORG, name: 'Synthetic own lead', status: 'new', source: 'manual', score: 0, inKanban: true },
      { id: FOREIGN, organizationId: OTHER_ORG, name: 'Private foreign lead', status: FOREIGN_STAGE, inKanban: true },
    ],
    leadPipelineStage: [
      { id: 'own-stage-id', organizationId: ORG, key: OWN_STAGE, title: 'Custom', order: 7, color: 'blue', isDefault: false, isSystem: false },
      { id: 'foreign-stage-id', organizationId: OTHER_ORG, key: FOREIGN_STAGE, title: 'Private', order: 1 },
    ],
    tag: [{ id: TAG, organizationId: ORG, name: 'Own tag', slug: 'own' }, { id: FOREIGN_TAG, organizationId: OTHER_ORG, name: 'Private tag', slug: 'private' }],
    user: [{ id: USER, organizationId: ORG, deletedAt: null }, { id: FOREIGN_USER, organizationId: OTHER_ORG, deletedAt: null }],
    leadTag: [{ leadId: OWN, tagId: TAG }, { leadId: OWN, tagId: FOREIGN_TAG }],
    activity: [],
  };
  const calls: { model: string; op: string; args: Args }[] = [];
  const writes: typeof calls = [];
  const evaluations: { request: ModuleAccessRequest; decision: AuthorizationDecision }[] = [];
  const notifications: unknown[] = [];
  function matches(model: string, row: Row, where: Record<string, any> = {}): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'AND') return value.every((clause: any) => matches(model, row, clause));
      if (key === 'leadId_tagId') return row.leadId === value.leadId && row.tagId === value.tagId;
      if (key === 'lead' || key === 'tag') return records[key].some((parent) => parent.id === row[key + 'Id'] && matches(key, parent, value));
      if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
      // Text/filter predicates are asserted on the captured query, not approximated as a database engine.
      if (value && typeof value === 'object') return true;
      return row[key] === value;
    });
  }
  function decorate(model: string, row: Row) {
    return model === 'leadTag' ? { ...row, tag: records.tag.find((tag) => tag.id === row.tagId) } : { ...row };
  }
  const prisma: Record<string, any> = {};
  for (const model of Object.keys(records)) {
    prisma[model] = {};
    for (const op of ['findFirst', 'findMany', 'count', 'create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']) {
      prisma[model][op] = async (args: Args = {}) => {
        calls.push({ model, op, args });
        if (state.relationUnavailable && model === 'leadPipelineStage') throw new Error('fixture database failure');
        const found = records[model].filter((row) => matches(model, row, args.where));
        if (op === 'findFirst') return found[0] ? decorate(model, found[0]) : null;
        if (op === 'findMany') return found.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take).map((row) => decorate(model, row));
        if (op === 'count') return found.length;
        writes.push({ model, op, args });
        if (op === 'create') return { id: 'created-fixture', ...args.data };
        if (op === 'createMany') return { count: args.data.length };
        if (op === 'update') {
          assertFound(found); return { ...found[0], ...args.data };
        }
        if (op === 'delete') { assertFound(found); return found[0]; }
        if (op === 'upsert') {
          const create = args.create;
          const leadId = create.lead?.connect.id ?? create.leadId;
          const tagId = create.tag?.connect.id ?? create.tagId;
          return decorate(model, { leadId, tagId });
        }
        return { count: found.length };
      };
    }
  }
  const infrastructure = { '@/lib/prisma': { prisma } };
  const legacy = loadServerModule(new URL('../../src/lib/checkPermission.ts', import.meta.url), {
    'next-auth': { getServerSession: async () => state.session }, '@/lib/auth': { authOptions: {} },
    '@/lib/permissions': { hasPermission, parsePermissions },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => state.user } } },
  });
  const authorize = createModuleAuthorizer({ session: async () => state.session, readUser: async () => {
    if (state.newEngineUnavailable) throw new Error('fixture new engine failure'); return state.user;
  } });
  const guards = loadServerModule(new URL('../../src/lib/authorization/guards.ts', import.meta.url), {
    '../checkPermission': legacy,
    './server': { evaluateModuleAccess: async (request: ModuleAccessRequest) => {
      const decision = await authorize(request); evaluations.push({ request, decision });
      return authorizationEffect(decision, mode);
    } },
  });
  const relations = loadServerModule(new URL('../../src/lib/leads/tenant-relations.ts', import.meta.url), infrastructure);
  const imports = { ...infrastructure, '@/lib/authorization/guards': guards, '@/lib/validations': validation,
    '@/lib/leads/tenant-relations': relations,
    '@/lib/notify': { createNotification: async (data: unknown) => { notifications.push(data); } },
    '@/lib/rate-limit': { applyRateLimit: () => null, API_RATE_LIMIT: {} },
    '@/lib/checkLimits': { checkPlanActive: async () => ({ active: state.legacyPlanActive, errorResponse: Response.json({ error: 'legacy-plan' }, { status: 403 }) }),
      checkOrganizationLimit: async () => ({ allowed: state.legacyLimitAllowed, errorResponse: Response.json({ error: 'legacy-limit' }, { status: 403 }) }) },
  };
  const paths: Record<Route, string> = { leads: 'leads', lead: 'leads/[id]', stage: 'leads/[id]/stage', tags: 'leads/[id]/tags',
    'bulk-update': 'leads/bulk-update', 'bulk-delete': 'leads/bulk-delete', import: 'import', stages: 'kanban/stages', 'stage-item': 'kanban/stages/[key]' };
  const handlers = Object.fromEntries(Object.entries(paths).map(([route, path]) => [route,
    loadServerModule<Handlers>(new URL(`../../src/app/api/${path}/route.ts`, import.meta.url), imports)])) as Record<Route, Handlers>;
  const defaultBody: Record<Route, unknown> = { leads: { name: 'New' }, lead: { name: 'Edited' }, stage: { status: OWN_STAGE }, tags: { tagId: TAG },
    'bulk-update': { ids: [OWN], action: 'setInKanban', inKanban: true }, 'bulk-delete': { ids: [OWN], confirmationText: 'EXCLUIR' },
    import: { leads: [{ name: 'Imported' }] }, stages: { title: 'New stage' }, 'stage-item': { title: 'Edited stage', order: 1 } };
  async function call(route: Route, method = 'GET', options: { id?: string; key?: string; body?: unknown; query?: string } = {}) {
    const request = new NextRequest(`http://localhost/api/${paths[route]}?organizationId=${OTHER_ORG}&mode=enforce&${options.query ?? ''}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-organization-id': OTHER_ORG, 'x-authorization-mode': 'enforce' },
      ...(method === 'GET' ? {} : { body: JSON.stringify(options.body ?? defaultBody[route]) }),
    });
    return handlers[route][method](request, { params: Promise.resolve({ id: options.id ?? OWN, key: options.key ?? OWN_STAGE }) });
  }
  return { call, state, actor, records, calls, writes, evaluations, notifications };
}
function assertFound(rows: Row[]) { if (!rows.length) throw new Error('Fixture mutation matched no resource'); }
