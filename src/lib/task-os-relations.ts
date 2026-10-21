// Data integrity for the existing Task/OS handlers; authentication remains checkPermission.
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/checkPermission';
import { hasPermission, parsePermissions } from '@/lib/permissions';
import type { PermissionModule, UserRole } from '@/types/permissions';

type References = { projectId?: string | null; leadId?: string | null; assignedToId?: string | null; createdById?: string | null };
export class InvalidResourceReference extends Error {}

export function relationError(error: unknown) {
  if (error instanceof InvalidResourceReference) {
    return NextResponse.json({ error: 'Referência indisponível ou não autorizada' }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2025', 'P2034'].includes(error.code)) {
    return NextResponse.json({ error: 'Conflito de atualização; tente novamente' }, { status: 409 });
  }
  return null;
}

// Apply before fetching relations, including counts and detail queries. Invalid historical
// links are quarantined from these responses; no historical data is rewritten.
export function resourceReadScope(organizationId: string, kind: 'task'): Promise<Prisma.TaskWhereInput>;
export function resourceReadScope(organizationId: string, kind: 'os'): Promise<Prisma.ServiceOrderWhereInput>;
export async function resourceReadScope(organizationId: string, kind: 'task' | 'os'): Promise<Prisma.TaskWhereInput | Prisma.ServiceOrderWhereInput> {
  const projects = await checkPermission('projects', 'view');
  const AND: Prisma.TaskWhereInput[] = [
    { OR: [{ projectId: null }, ...(projects.allowed ? [{ project: { organizationId } }] : [])] },
    { OR: [{ assignedToId: null }, { assignedTo: { organizationId } }] },
    { OR: [{ createdById: null }, { createdBy: { organizationId } }] },
  ];
  if (kind === 'task') {
    const leads = await checkPermission('leads', 'view');
    AND.push({ OR: [{ leadId: null }, ...(leads.allowed ? [{ lead: { organizationId } }] : [])] });
  }
  return { organizationId, AND };
}

export const taskAttachmentsScope = (organizationId: string) => ({
  organizationId, entityType: 'task',
  OR: [{ uploadedById: null }, { uploadedBy: { organizationId } }],
});
export const taskCommentsScope = (organizationId: string) => ({
  organizationId, entityType: 'task', author: { organizationId },
});

// Lock the root before reading effective PUT values, so parallel updates cannot validate
// one snapshot and then serialize another. Table identifiers are a closed constant set.
export async function lockResource(tx: Prisma.TransactionClient, kind: 'task' | 'os', id: string, organizationId: string) {
  const table = kind === 'task' ? Prisma.sql`tasks` : Prisma.sql`service_orders`;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM ${table} WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`);
}

export async function validateResourceReferences(tx: Prisma.TransactionClient, organizationId: string, actorId: string, refs: References) {
  // SHARE (not KEY SHARE) also prevents concurrent tenant reassignment and soft deletion
  // while the resource, activity and notifications are committed atomically.
  const lock = async (table: Prisma.Sql, id: string, active = false) => {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM ${table} WHERE id = ${id} AND organization_id = ${organizationId}
      ${active ? Prisma.sql`AND deleted_at IS NULL` : Prisma.empty} FOR SHARE`);
    if (!rows.length) throw new InvalidResourceReference();
  };
  await lock(Prisma.sql`users`, actorId, true);
  if (refs.createdById) await lock(Prisma.sql`users`, refs.createdById);
  if (refs.assignedToId) await lock(Prisma.sql`users`, refs.assignedToId, true);
  if (refs.projectId) {
    if (!(await checkPermission('projects', 'view')).allowed) throw new InvalidResourceReference();
    await lock(Prisma.sql`marketing_projects`, refs.projectId);
  }
  if (refs.leadId) {
    if (!(await checkPermission('leads', 'view')).allowed) throw new InvalidResourceReference();
    await lock(Prisma.sql`leads`, refs.leadId);
  }
}

export async function resourceNotification(tx: Prisma.TransactionClient, organizationId: string, refs: References,
  data: Prisma.NotificationUncheckedCreateInput) {
  const recipient = await tx.user.findFirst({ where: { id: data.userId, organizationId, deletedAt: null } });
  if (!recipient) return;
  const permissions = parsePermissions(recipient.permissions, recipient.role as UserRole);
  const allowed = (module: PermissionModule) => recipient.role === 'owner' || hasPermission(permissions, module, 'view');
  if (!allowed(data.entityType === 'os' ? 'os' : 'tasks') ||
      (refs.leadId && !allowed('leads')) || (refs.projectId && !allowed('projects'))) return;
  await tx.notification.create({ data });
}
