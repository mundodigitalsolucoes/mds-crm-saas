import { resolveCommercialEntitlements } from '../entitlements/resolver';
import { DOMAIN_SETTINGS_KEY, readDomainState, readSettings } from './model';
/** Invalidation only: the existing resolver remains the sole commercial authority. */
export function domainCapabilityPatch(org: { id: string; plan: string; features: string; settings: string }, nextFeatures: string): { settings?: string } {
  const before = resolveCommercialEntitlements(org).capabilities.includes('custom_domain');
  const after = resolveCommercialEntitlements({ ...org, features: nextFeatures }).capabilities.includes('custom_domain');
  const state = readDomainState(org.settings);
  if (before === after || !state) return {};
  return { settings: JSON.stringify({ ...readSettings(org.settings), [DOMAIN_SETTINGS_KEY]: { ...state, status: 'disabled' } }) };
}
export const domainCapabilityAudit = (organizationId: string) => ({
  entityType: 'organization', entityId: organizationId, action: 'updated', userId: null,
  description: 'Domínio desativado por alteração de capacidade comercial',
  metadata: JSON.stringify({ actorType: 'system', reason: 'custom_domain_capability_changed' }),
});
