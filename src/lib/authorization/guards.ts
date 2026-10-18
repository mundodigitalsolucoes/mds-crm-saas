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
