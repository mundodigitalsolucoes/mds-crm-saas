import { NextResponse } from 'next/server';
import { checkPermission } from '../checkPermission';
import { evaluateModuleAccess } from './server';
import { authorizationEffect, modeForOrganization } from './policy';
import type { AuthorizationDecision, ModuleAccessRequest } from './authorize';

/** Structured, finite metadata only. Never include tenant/user/resource IDs, claims or DB errors. */
export function recordAuthorizationObservation(request: ModuleAccessRequest, decision: AuthorizationDecision) {
  console.info('[MODULE_AUTHORIZATION]', JSON.stringify({
    module: request.module, permission: request.permission, action: request.action, reason: decision.reason,
  }));
}

export async function checkModulePermission(request: ModuleAccessRequest) {
  // Preserve the original identity/membership/operational check and its exact result contract.
  const legacy = await checkPermission(request.permission, request.action);
  if (!legacy.allowed) return legacy;
  const evaluation = await evaluateModuleAccess(request);
  // A fresh session read may observe a membership change during this request.
  // Never enforce a decision for a different user/tenant on the legacy operation's context.
  const decision: AuthorizationDecision = evaluation.decision.allowed
    && (evaluation.decision.context.organizationId !== legacy.session?.user.organizationId
      || evaluation.decision.context.userId !== legacy.session?.user.id)
    ? { allowed: false, reason: 'invalid_organization', status: 403 }
    : evaluation.decision;
  const mode = evaluation.mode === 'enforce' ? 'enforce' : modeForOrganization(legacy.session?.user.organizationId);
  const { block } = authorizationEffect(decision, mode);
  recordAuthorizationObservation(request, decision);
  if (block && !decision.allowed) {
    return { allowed: false, session: legacy.session, errorResponse: NextResponse.json(
      { error: 'Acesso indisponível', code: decision.reason }, { status: decision.status },
    ) };
  }
  // observe_only retains the legacy decision, never substitutes allowed:true on a new-engine error.
  return legacy;
}

/** C5 additive boundary after the handler's existing operational guard. */
export async function commercialModuleDenial(
  session: { user: { id: string; organizationId: string } }, request: ModuleAccessRequest,
): Promise<NextResponse | null> {
  if (modeForOrganization(session.user.organizationId) !== 'enforce') return null;
  const result = await checkModulePermission(request);
  if (!result.allowed) return result.errorResponse ?? NextResponse.json({ error: 'Acesso indisponível' }, { status: 403 });
  if (result.session?.user.id !== session.user.id || result.session.user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Acesso indisponível' }, { status: 403 });
  }
  return null;
}

/** Task type selects its module; linked Lead/Project retain their independent contracts. */
export async function taskCommercialDenial(
  session: { user: { id: string; organizationId: string } }, action: ModuleAccessRequest['action'],
  task: { type?: string; leadId?: string | null; projectId?: string | null },
): Promise<NextResponse | null> {
  const { taskModuleRequirements } = await import('./operation-data');
  const requests = taskModuleRequirements(task, action);
  for (const request of requests) {
    const denied = await commercialModuleDenial(session, request);
    if (denied) return denied;
  }
  return null;
}

/** Shared-resource boundary; caller supplies its existing transaction and verified session. */
export async function commercialEntityDenial(
  client: import('@prisma/client').Prisma.TransactionClient,
  session: { user: { id: string; organizationId: string } },
  entityType: string, entityId: string, action: ModuleAccessRequest['action'],
): Promise<NextResponse | null> {
  const { Prisma } = await import('@prisma/client');
  const { hasPermission, parsePermissions } = await import('../permissions');
  const actors = await client.$queryRaw<{ role: string; permissions: string }[]>(Prisma.sql`
    SELECT u.role, u.permissions FROM users u JOIN organizations o ON o.id = u.organization_id
    WHERE u.id = ${session.user.id} AND u.organization_id = ${session.user.organizationId}
      AND u.deleted_at IS NULL AND o.deleted_at IS NULL FOR SHARE OF u, o`);
  const actor = actors[0];
  if (!actor) return NextResponse.json({ error: 'Acesso indisponível' }, { status: 403 });
  const { entityModuleRequirements } = await import('./operation-data');
  const requests = await entityModuleRequirements(client, session.user.organizationId, entityType, entityId, action);
  if (!requests) return NextResponse.json({ error: 'Recurso indisponível' }, { status: 404 });
  // Existing legacy semantics, including owner, remain independent of commercial mode.
  for (const request of requests) {
    if (actor.role !== 'owner' && !hasPermission(parsePermissions(actor.permissions, actor.role as import('@/types/permissions').UserRole), request.permission, request.action)) {
      return NextResponse.json({ error: 'Acesso indisponível' }, { status: 403 });
    }
  }
  if (modeForOrganization(session.user.organizationId) !== 'enforce') return null;
  for (const request of requests) {
    const evaluation = await evaluateModuleAccess(request, { client, session });
    recordAuthorizationObservation(request, evaluation.decision);
    if (!evaluation.decision.allowed) return NextResponse.json({ error: 'Acesso indisponível' }, { status: evaluation.decision.status });
    if (evaluation.decision.context.userId !== session.user.id || evaluation.decision.context.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Acesso indisponível' }, { status: 403 });
    }
  }
  return null;
}
