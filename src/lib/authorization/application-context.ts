import { checkAuth, checkPermission } from '../checkPermission';
import { getOrganizationEntitlements } from '../entitlements/organization';
import { modeForOrganization } from './policy';
import type { CommercialModuleId } from '../entitlements/catalog';
import type { PermissionModule } from '@/types/permissions';

/** Presentation only: never an API grant or a switch for commercial enforcement. */
export interface ApplicationContext {
  organizationId: string;
  userId: string;
  modules: CommercialModuleId[];
  views: Partial<Record<PermissionModule, boolean>>;
  mode: 'observe_only' | 'enforce';
}

export async function getApplicationContext(): Promise<ApplicationContext | null> {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.session) return null;
  const { id: userId, organizationId } = auth.session.user;
  const result = await getOrganizationEntitlements(organizationId);
  if (!result.ok) return null;
  const resources = ['leads', 'kanban', 'agenda', 'tasks', 'goals', 'projects', 'os', 'reports', 'users', 'integrations', 'atendimento'] as const;
  const checks = await Promise.all(resources.map(resource => checkPermission(resource, 'view')));
  if (checks.some(check => !check.session || check.session.user.id !== userId ||
    check.session.user.organizationId !== organizationId)) return null;
  return {
    organizationId, userId,
    modules: result.entitlements.modules,
    views: Object.fromEntries(resources.map((resource, i) => [resource, checks[i].allowed])),
    mode: modeForOrganization(organizationId),
  };
}
