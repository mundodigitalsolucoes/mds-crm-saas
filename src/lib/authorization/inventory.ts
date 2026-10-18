import { createHash } from 'node:crypto';
import { parseCommercialFeatures } from '../entitlements/features';
import { resolveCommercialEntitlements } from '../entitlements/resolver';

export interface InventoryRow {
  id: string; plan: string; planStatus: string; features: unknown;
  planFound: boolean; planFeatures: unknown;
  organizationDeleted?: boolean;
  trialEndsAt?: Date | null;
}
const ref = (value: string) => createHash('sha256').update(value).digest('hex');

/** Pseudonymous diagnostics only. Never return names, raw IDs, settings, tokens or raw unknown strings. */
export function diagnoseOrganization(row: InventoryRow) {
  const commercial = resolveCommercialEntitlements(row);
  const plan = parseCommercialFeatures(row.planFeatures);
  const organization = commercial.parsed;
  const orgSet = [...organization.features, ...organization.unknown].sort();
  const planSet = [...plan.features, ...plan.unknown].sort();
  const divergence = !row.planFound ? 'plan_missing'
    : organization.status === 'invalid' || organization.status === 'missing' || plan.status === 'invalid' || plan.status === 'missing'
      ? 'not_comparable' : JSON.stringify(orgSet) === JSON.stringify(planSet) ? 'aligned' : 'different';
  return {
    organizationRef: ref(row.id), planRef: ref(row.plan),
    subscriptionStatus: ['active', 'cancelled', 'past_due', 'trial_expired'].includes(row.planStatus) ? row.planStatus : 'unknown',
    organizationState: row.organizationDeleted ? 'deleted' : 'active',
    featureFormat: organization.status, modules: commercial.modules,
    planFeatureFormat: row.planFound ? plan.status : null, divergence,
    unknownFeatureCount: organization.unknown.length,
    requiresReview: commercial.compatibility.needsMigrationReview || divergence !== 'aligned' || row.planStatus !== 'active'
      || Boolean(row.organizationDeleted) || (row.plan === 'trial' && (!row.trialEndsAt || row.trialEndsAt <= new Date())),
  };
}

export const INVENTORY_READ_QUERY = `
SELECT o.id, o.plan, o.plan_status AS "planStatus", o.features,
       (o.deleted_at IS NOT NULL) AS "organizationDeleted", o.trial_ends_at AS "trialEndsAt",
       (p.id IS NOT NULL) AS "planFound", p.features AS "planFeatures"
FROM organizations o LEFT JOIN plans p ON p.name = o.plan
ORDER BY o.id`;

export async function readInventory(client: { query: (sql: string) => Promise<{ rows: InventoryRow[] }> }) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    const result = await client.query(INVENTORY_READ_QUERY);
    return result.rows.map(diagnoseOrganization);
  } finally {
    // Diagnostics never commit or mutate state, even on a query/serialization failure.
    await client.query('ROLLBACK');
  }
}
