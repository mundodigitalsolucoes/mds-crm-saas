import type { AuthorizationDecision } from './authorize';

export type AuthorizationMode = 'observe_only' | 'enforce';
export interface EnforcementApproval {
  organizationId: string;
  approvalReference: string;
  inventoryReviewed: true;
  coverageReviewed: true;
}

/** Server deployment manifest. No approvals exist; no env/header/query/body switch can enable it. */
const APPROVED_ENFORCEMENTS: readonly EnforcementApproval[] = [];

export function modeForOrganization(organizationId: string | undefined): AuthorizationMode {
  return APPROVED_ENFORCEMENTS.some((entry) => entry.organizationId === organizationId
    && entry.approvalReference.trim() && entry.inventoryReviewed && entry.coverageReviewed) ? 'enforce' : 'observe_only';
}

/** Observe is not a grant: the caller must still execute the complete existing authorization. */
export function authorizationEffect(decision: AuthorizationDecision, mode: AuthorizationMode) {
  return { decision, mode, block: mode === 'enforce' && !decision.allowed };
}
