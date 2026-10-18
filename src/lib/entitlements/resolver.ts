import {
  FEATURE_CATALOG, featuresOfKind, isFeatureId,
  type CapabilityId, type CommercialModuleId, type FeatureIdOf, type FeatureKind,
} from './catalog';
import { parseCommercialFeatures } from './features';

export interface OrganizationFeatureSnapshot {
  id: string;
  plan: string;
  features: unknown;
}

/** A read-only repository boundary; no global tenant cache or implicit Plan fallback. */
export type OrganizationFeatureReader =
  (organizationId: string) => Promise<OrganizationFeatureSnapshot | null>;

export function resolveCommercialEntitlements(organization: OrganizationFeatureSnapshot) {
  const parsed = parseCommercialFeatures(organization.features);
  const explicit = new Set<string>(parsed.features);
  const includes = (id: string) => explicit.has(id);
  const granted = <K extends FeatureKind>(kind: K): FeatureIdOf<K>[] =>
    featuresOfKind(kind).filter((id) =>
      FEATURE_CATALOG[id].availability === 'available' && includes(id));
  const modules = granted('module');
  const unavailable = parsed.features.filter((id) => FEATURE_CATALOG[id].availability !== 'available');
  const reasons: string[] = [];
  if (parsed.status !== 'valid') reasons.push(parsed.status);
  if (parsed.unknown.length) reasons.push('unknown_features');
  if (unavailable.length) reasons.push('unavailable_features');
  if (parsed.status === 'valid' && !modules.length) reasons.push('no_explicit_modules');

  return {
    organizationId: organization.id,
    plan: organization.plan,
    parsed,
    modules: modules as CommercialModuleId[],
    capabilities: granted('capability') as CapabilityId[],
    channels: granted('channel'),
    addons: granted('addon'),
    compatibility: {
      mode: 'observe_only' as const,
      enforcementEnabled: false as const,
      needsMigrationReview: reasons.length > 0,
      reasons,
    },
    module(id: string) {
      const known = isFeatureId(id) && FEATURE_CATALOG[id].kind === 'module';
      const available = known && isFeatureId(id) && FEATURE_CATALOG[id].availability === 'available';
      return {
        known,
        available,
        explicitlyListed: known && includes(id),
        // Never interprets empty/invalid configuration as universal authorization.
        contracted: available && includes(id),
      };
    },
  };
}

export type CommercialEntitlements = ReturnType<typeof resolveCommercialEntitlements>;
export type EntitlementReadResult =
  | { ok: true; entitlements: CommercialEntitlements }
  | { ok: false; organizationId: string; reason: 'invalid_organization_id' | 'not_found' | 'tenant_mismatch' | 'read_failed' };

/** The caller must authenticate/authorize the tenant ID; this is not a route guard. */
export function createEntitlementResolver(read: OrganizationFeatureReader) {
  return async (organizationId: string): Promise<EntitlementReadResult> => {
    if (!organizationId.trim()) return { ok: false, organizationId, reason: 'invalid_organization_id' };
    try {
      const organization = await read(organizationId);
      if (!organization) return { ok: false, organizationId, reason: 'not_found' };
      if (organization.id !== organizationId) return { ok: false, organizationId, reason: 'tenant_mismatch' };
      return { ok: true, entitlements: resolveCommercialEntitlements(organization) };
    } catch {
      // No error payload or credential leakage, no permissive fallback.
      return { ok: false, organizationId, reason: 'read_failed' };
    }
  };
}
