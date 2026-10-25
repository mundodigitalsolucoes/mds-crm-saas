import { prisma } from '@/lib/prisma';
import { resolveCommercialEntitlements } from './entitlements/resolver';
import { DEFAULT_BRANDING, brandingValues, type OrgBranding } from './branding-values';
export { DEFAULT_BRANDING, brandingCssVars } from './branding-values';
export type { OrgBranding } from './branding-values';

/** Caller must validate membership or an active verified public hostname first. No shared tenant cache, no provider fetch. */
export async function getOrgBranding(organizationId: string): Promise<OrgBranding> {
  try {
    const org = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, plan: true, features: true, name: true, logo: true, favicon: true, primaryColor: true, secondaryColor: true },
    });
    if (!org || !resolveCommercialEntitlements(org).capabilities.includes('white_label')) return { ...DEFAULT_BRANDING };
    return brandingValues(org);
  } catch { return { ...DEFAULT_BRANDING }; }
}
