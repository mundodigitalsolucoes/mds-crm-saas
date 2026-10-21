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

/** Resolve only persisted, tenant-owned bindings; never infer a module from a client claim. */
export async function entityModuleRequirements(
  client: import('@prisma/client').Prisma.TransactionClient, organizationId: string,
  entityType: string, entityId: string, action: import('./authorize').ModuleAccessRequest['action'],
): Promise<import('./authorize').ModuleAccessRequest[] | null> {
  const { Prisma } = await import('@prisma/client');
  if (entityType === 'comment') {
    const rows = await client.$queryRaw<{ entityType: string; entityId: string }[]>(Prisma.sql`
      SELECT c.entity_type AS "entityType", c.entity_id AS "entityId" FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.id = ${entityId} AND c.organization_id = ${organizationId}
        AND u.organization_id = ${organizationId} FOR SHARE OF c, u`);
    if (!rows[0] || !['task', 'lead', 'goal', 'kanban_card'].includes(rows[0].entityType)) return null;
    return entityModuleRequirements(client, organizationId, rows[0].entityType, rows[0].entityId, action);
  }
  if (entityType === 'task') {
    const rows = await client.$queryRaw<{ type: string; leadId: string | null; projectId: string | null }[]>(Prisma.sql`
      SELECT type, lead_id AS "leadId", project_id AS "projectId" FROM tasks
      WHERE id = ${entityId} AND organization_id = ${organizationId} FOR SHARE`);
    const task = rows[0];
    if (!task) return null;
    if (task.leadId && !await client.lead.findFirst({ where: { id: task.leadId, organizationId }, select: { id: true } })) return null;
    if (task.projectId && !await client.marketingProject.findFirst({ where: { id: task.projectId, organizationId }, select: { id: true } })) return null;
    return taskModuleRequirements(task, action);
  }
  if (entityType === 'kanban_card') {
    const rows = await client.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT c.id FROM kanban_cards c JOIN kanban_columns col ON col.id = c.column_id
      JOIN kanban_boards b ON b.id = col.board_id
      WHERE c.id = ${entityId} AND b.organization_id = ${organizationId} FOR SHARE OF c, col, b`);
    return rows.length ? [{ module: 'vendas', permission: 'tasks', action }] : null;
  }
  if (entityType !== 'lead' && entityType !== 'goal') return null;
  const table = entityType === 'lead' ? Prisma.sql`leads` : Prisma.sql`goals`;
  const rows = await client.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM ${table} WHERE id = ${entityId} AND organization_id = ${organizationId} FOR SHARE`);
  return rows.length ? [{ module: 'vendas', permission: entityType === 'lead' ? 'leads' : 'projects', action }] : null;
}

/** One task binding rule, reused by direct and indirect resource boundaries. */
export function taskModuleRequirements(
  task: { type?: string; leadId?: string | null; projectId?: string | null },
  action: import('./authorize').ModuleAccessRequest['action'],
): import('./authorize').ModuleAccessRequest[] {
  return [
    { module: task.type === 'follow_up' ? 'vendas' : 'marketing', permission: 'tasks', action },
    ...(task.leadId ? [{ module: 'vendas' as const, permission: 'leads' as const, action: 'view' as const }] : []),
    ...(task.projectId ? [{ module: 'marketing' as const, permission: 'projects' as const, action: 'view' as const }] : []),
  ];
}
