import { modeForOrganization } from './policy';

/** Query restrictions for existing shared resources; never a permission or tenant grant. */
export async function commercialResourceScope(organizationId: string, kind: 'task') {
  if (kind !== 'task') throw Error('Unsupported commercial resource');
  if (modeForOrganization(organizationId) !== 'enforce') return {};
  const { getOrganizationEntitlements } = await import('../entitlements/organization');
  const result = await getOrganizationEntitlements(organizationId);
  if (!result.ok) throw Error('Commercial resource scope unavailable');
  return taskReadScopeForModules(result.entitlements.modules);
}

/** Query predicate only, to combine with existing tenant and operational scopes. */
export function taskReadScopeForModules(modules: readonly string[]) {
  const sales = modules.includes('vendas');
  const marketing = modules.includes('marketing');
  if (!sales && !marketing) return { id: { in: [] } };
  return { AND: [
    { OR: [...(sales ? [{ type: 'follow_up' }] : []), ...(marketing ? [{ type: { not: 'follow_up' } }] : [])] },
    ...(sales ? [] : [{ leadId: null }]), ...(marketing ? [] : [{ projectId: null }]),
  ] };
}
