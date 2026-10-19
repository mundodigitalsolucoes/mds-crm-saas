import { prisma } from '../prisma';
import { evaluateCommercialChannelAccess } from '../entitlements/channel-access';
import type { ChannelId } from '../entitlements/catalog';

/** Observation only: never authorizes or blocks an operation; operational guards run first. */
export async function observeChannelEntitlement(organizationId: string, channel: ChannelId): Promise<void> {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true, features: true },
    });
    const decision = organization
      ? evaluateCommercialChannelAccess(organization, channel)
      : { allowed: false as const, reason: 'organization_not_found' as const };
    // Deliberately omit organization/user identifiers, credentials and provider data.
    console.info('[CHANNEL_ENTITLEMENT_OBSERVATION]', JSON.stringify({
      channel, allowed: decision.allowed, reason: decision.reason, mode: 'observe_only',
    }));
  } catch {
    console.info('[CHANNEL_ENTITLEMENT_OBSERVATION]', JSON.stringify({
      channel, allowed: false, reason: 'read_failed', mode: 'observe_only',
    }));
  }
}
