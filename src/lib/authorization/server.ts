import type { Prisma } from '@prisma/client';
import type { TrustedSessionIdentity } from './authorize';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth';
import { prisma } from '../prisma';
import { createModuleAuthorizer, createAdministrativeAuthorizer, type ModuleAccessRequest } from './authorize';
import { verifyAdminToken } from '../admin-auth';
import { authorizationEffect, modeForOrganization } from './policy';

/** Context is server-owned and used only after the caller authenticates/locks the actor. */
export interface TransactionAuthorizationContext {
  session: TrustedSessionIdentity;
  client: Prisma.TransactionClient;
}

export async function evaluateModuleAccess(request: ModuleAccessRequest, context?: TransactionAuthorizationContext) {
  const database = context?.client ?? prisma;
  let trustedOrganizationId: string | undefined;
  const authorize = createModuleAuthorizer({
    session: async () => {
      const session = context?.session ?? await getServerSession(authOptions);
      trustedOrganizationId = session?.user?.organizationId;
      return session ?? null;
    },
    readUser: (id) => database.user.findUnique({
      where: { id },
      select: {
        id: true, organizationId: true, deletedAt: true, role: true, permissions: true,
        organization: { select: {
          id: true, deletedAt: true, plan: true, planStatus: true, trialEndsAt: true, features: true, maxProjects: true,
        } },
      },
    }),
    additionalRules: async ({ organization }, request) => {
      // Existing project quota, read strictly (no permissive catch); not channel limits.
      if (request.module !== 'marketing' || request.action !== 'create') return true;
      if (!Number.isInteger(organization.maxProjects)) return false;
      if (organization.maxProjects <= 0) return true; // Existing scalar convention, unchanged.
      return await database.marketingProject.count({ where: { organizationId: organization.id } }) < organization.maxProjects;
    },
  });
  return authorizationEffect(await authorize(request), modeForOrganization(trustedOrganizationId));
}

export async function authorizeModuleAccess(request: ModuleAccessRequest) {
  return (await evaluateModuleAccess(request)).decision;
}

// Prepared for explicit administrative integration; existing plan APIs remain unchanged.
export const authorizeAdministrativeAccess = createAdministrativeAuthorizer({
  session: verifyAdminToken,
  readAdmin: (id) => prisma.superAdmin.findUnique({ where: { id }, select: { id: true } }),
  readOrganization: (id) => prisma.organization.findUnique({ where: { id }, select: { id: true, deletedAt: true } }),
});
