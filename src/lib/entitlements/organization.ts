import { prisma } from '../prisma';
import { createEntitlementResolver } from './resolver';

/** Server-only, exact-tenant read of the existing organization subscription snapshot. */
export const getOrganizationEntitlements = createEntitlementResolver((organizationId) =>
  prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, plan: true, features: true },
  }));
