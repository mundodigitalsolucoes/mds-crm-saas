import { z } from 'zod';
import { FEATURE_CATALOG, isFeatureId, type AddonId, type ChannelId } from './catalog';

/** Future contract only: no persistence, provisioning or runtime limit enforcement. */
export interface ChannelEntitlementContract {
  version: 1;
  channels: Partial<Record<ChannelId, { allowed: boolean; maxConnections: number }>>;
  addons: Partial<Record<AddonId, number>>;
}

const channelId = z.custom<ChannelId>((id) =>
  typeof id === 'string' && isFeatureId(id) && FEATURE_CATALOG[id].kind === 'channel');
const addonId = z.custom<AddonId>((id) =>
  typeof id === 'string' && isFeatureId(id) && FEATURE_CATALOG[id].kind === 'addon');

export const channelEntitlementContractSchema: z.ZodType<ChannelEntitlementContract> = z.object({
  version: z.literal(1),
  channels: z.record(channelId, z.object({
    allowed: z.boolean(),
    // Zero means zero connections. No legacy <= 0 unlimited interpretation.
    maxConnections: z.number().int().nonnegative().safe(),
  }).strict().refine((value) => value.allowed || value.maxConnections === 0,
    'A disallowed channel must have zero connections')),
  addons: z.record(addonId, z.number().int().nonnegative().safe()),
}).strict();

export function parseChannelEntitlementContract(input: unknown) {
  return channelEntitlementContractSchema.safeParse(input);
}
