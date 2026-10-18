import { prisma } from '@/lib/prisma';

// Existing scalar statuses/aliases remain valid before default stages have been materialized.
const LEGACY_STATUSES = new Set([
  'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'contact', 'closed',
  'novo lead', 'novo', 'lead novo', 'em contato', 'contato', 'proposta enviada', 'proposta',
  'fechado', 'ganho', 'perdido',
]);

/** Status is a scalar, not a stage FK. Preserve tenant-local legacy values without granting a foreign stage. */
export async function isTenantLeadStatus(organizationId: string, status: string | undefined) {
  if (status === undefined || LEGACY_STATUSES.has(status.trim().toLowerCase())) return true;
  const stage = await prisma.leadPipelineStage.findFirst({
    where: { organizationId, key: status }, select: { id: true },
  });
  if (stage) return true;
  return !!await prisma.lead.findFirst({
    where: { organizationId, status }, select: { id: true },
  });
}

/** Omitted/cleared assignees do not force a review of previously stored relationships. */
export async function isTenantLeadAssignee(organizationId: string, assignedToId: string | null | undefined) {
  if (!assignedToId) return true;
  return !!await prisma.user.findFirst({
    where: { id: assignedToId, organizationId, deletedAt: null }, select: { id: true },
  });
}
