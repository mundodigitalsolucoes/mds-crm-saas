import { resolveCommercialEntitlements, type OrganizationFeatureSnapshot } from './resolver';
import { FEATURE_CATALOG, type ChannelId } from './catalog';

/** Pure commercial decision. This does not authorize a user, resource, provider or request. */
export type ChannelAccessDecision =
  | { allowed: true; reason: 'allowed' }
  | { allowed: false; reason: 'module_not_contracted' | 'channel_not_contracted' | 'channel_unavailable' | 'invalid_features' };

export function evaluateCommercialChannelAccess(
  organization: OrganizationFeatureSnapshot,
  channel: ChannelId,
): ChannelAccessDecision {
  const entitlements = resolveCommercialEntitlements(organization);
  if (entitlements.parsed.status !== 'valid' || entitlements.parsed.unknown.length > 0) {
    return { allowed: false, reason: 'invalid_features' };
  }
  if (!entitlements.module('atendimento').contracted) {
    return { allowed: false, reason: 'module_not_contracted' };
  }
  if (FEATURE_CATALOG[channel].kind !== 'channel' || FEATURE_CATALOG[channel].availability !== 'available') {
    return { allowed: false, reason: 'channel_unavailable' };
  }
  if (!entitlements.channels.includes(channel)) {
    return { allowed: false, reason: 'channel_not_contracted' };
  }
  return { allowed: true, reason: 'allowed' };
}
