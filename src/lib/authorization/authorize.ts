import { resolveCommercialEntitlements } from '../entitlements/resolver';
import { FEATURE_CATALOG, isFeatureId, type CommercialModuleId } from '../entitlements/catalog';
import { ALL_MODULES, hasPermission, parsePermissions } from '../permissions';
import type { PermissionAction, PermissionModule, UserRole } from '../../types/permissions';

export interface TrustedSessionIdentity { user: { id: string; organizationId: string } }
export interface AuthorizationOrganization {
  id: string; deletedAt: Date | null; plan: string; planStatus: string;
  trialEndsAt: Date | null; features: unknown; maxProjects: number;
}
export interface AuthorizationUser {
  id: string; organizationId: string; deletedAt: Date | null;
  role: string; permissions: string; organization: AuthorizationOrganization | null;
}
export interface ModuleAccessRequest {
  module: CommercialModuleId;
  permission: PermissionModule;
  action: PermissionAction;
}
export type DenialReason = 'unauthenticated' | 'invalid_organization' | 'inactive_membership'
  | 'inactive_subscription' | 'module_not_contracted' | 'module_unavailable'
  | 'insufficient_permission' | 'additional_rule_denied' | 'infrastructure_error';
export type AuthorizationDecision =
  | { allowed: true; reason: 'allowed'; status: 200; context: { userId: string; organizationId: string } }
  | { allowed: false; reason: DenialReason; status: 401 | 403 | 503 };

const deny = (reason: DenialReason, status: 401 | 403 | 503 = 403): AuthorizationDecision =>
  ({ allowed: false, reason, status });

/** Only audited operational permission pairs. Shared resources need their own approved rule. */
const modulePermissions: Partial<Record<CommercialModuleId, readonly PermissionModule[]>> = {
  marketing: ['projects', 'tasks', 'os', 'reports'],
  vendas: ['leads', 'kanban', 'tasks', 'projects', 'goals', 'agenda'],
  atendimento: ['atendimento', 'integrations'],
};

function validPermissions(raw: string): boolean {
  // Explicit legacy defaults are retained; corrupt JSON is never interpreted as defaults.
  if (raw === '') return true;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return value.length === 0;
    if (!value || typeof value !== 'object') return false;
    if (Object.keys(value).length === 0) return true;
    if (!Object.keys(value).some(key => ALL_MODULES.includes(key as PermissionModule))) return false;
    return Object.values(value).every((entry) => entry !== null && typeof entry === 'object'
      && !Array.isArray(entry) && Object.values(entry).every((flag) => typeof flag === 'boolean'));
  } catch { return false; }
}

/** No cache, JWT role/feature claims or client-selected tenant. The session adapter is server-owned. */
export function createModuleAuthorizer(dependencies: {
  session: () => Promise<TrustedSessionIdentity | null>;
  readUser: (userId: string) => Promise<AuthorizationUser | null>;
  now?: () => Date;
  additionalRules?: (context: { user: AuthorizationUser; organization: AuthorizationOrganization }, request: ModuleAccessRequest) => Promise<boolean>;
}) {
  return async function authorizeModuleAccess(request: ModuleAccessRequest): Promise<AuthorizationDecision> {
    try {
      const session = await dependencies.session();
      if (!session?.user?.id || !session.user.organizationId) return deny('unauthenticated', 401);
      const user = await dependencies.readUser(session.user.id);
      if (!user || user.id !== session.user.id || user.deletedAt) return deny('inactive_membership');
      const organization = user.organization;
      if (user.organizationId !== session.user.organizationId || !organization || organization.deletedAt
        || organization.id !== user.organizationId) return deny('invalid_organization');

      const now = (dependencies.now ?? (() => new Date()))();
      if (organization.planStatus !== 'active' || (organization.plan === 'trial'
        && (!organization.trialEndsAt || !Number.isFinite(organization.trialEndsAt.getTime())
          || organization.trialEndsAt <= now))) return deny('inactive_subscription');

      if (!isFeatureId(request.module) || FEATURE_CATALOG[request.module].kind !== 'module'
        || FEATURE_CATALOG[request.module].availability !== 'available') return deny('module_unavailable');
      const commercial = resolveCommercialEntitlements(organization);
      if (!commercial.module(request.module).contracted) return deny('module_not_contracted');

      if (!modulePermissions[request.module]?.includes(request.permission)
        || !['view', 'create', 'edit', 'delete'].includes(request.action)
        || !['owner', 'admin', 'manager', 'user'].includes(user.role)
        || !validPermissions(user.permissions)
        || !hasPermission(parsePermissions(user.permissions, user.role as UserRole), request.permission, request.action)) {
        return deny('insufficient_permission');
      }
      if (dependencies.additionalRules && !await dependencies.additionalRules({ user, organization }, request)) {
        return deny('additional_rule_denied');
      }
      return { allowed: true, reason: 'allowed', status: 200, context: { userId: user.id, organizationId: organization.id } };
    } catch { return deny('infrastructure_error', 503); }
  };
}

/** Explicit administrative authority never becomes a tenant-user session or a commercial bypass. */
export function createAdministrativeAuthorizer(dependencies: {
  session: () => Promise<{ id: string; role: string } | null>;
  readAdmin: (id: string) => Promise<{ id: string } | null>;
  readOrganization: (id: string) => Promise<{ id: string; deletedAt: Date | null } | null>;
}) {
  return async (target: { kind: 'plans' } | { kind: 'organization'; organizationId: string }) => {
    try {
      const actor = await dependencies.session();
      if (!actor || actor.role !== 'superadmin') return { allowed: false, reason: 'unauthenticated' } as const;
      const admin = await dependencies.readAdmin(actor.id);
      if (!admin || admin.id !== actor.id) return { allowed: false, reason: 'unauthenticated' } as const;
      if (target.kind === 'organization') {
        const org = await dependencies.readOrganization(target.organizationId);
        if (!org || org.id !== target.organizationId || org.deletedAt) return { allowed: false, reason: 'invalid_organization' } as const;
      }
      return { allowed: true, reason: 'administrative_authority', scope: target } as const;
    } catch { return { allowed: false, reason: 'infrastructure_error' } as const; }
  };
}
