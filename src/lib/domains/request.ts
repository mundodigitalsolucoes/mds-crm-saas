import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { resolveCommercialEntitlements } from '../entitlements/resolver';
import { domainIsActive, normalizeDomain, readDomainState } from './model';
import { proxySecret, sameSecret } from './network';

export type DomainContext = { kind: 'primary'; origin: string } | { kind: 'custom'; origin: string; organizationId: string; hostname: string; active: boolean } | { kind: 'denied' };
type HeaderInput = Headers | Record<string, string | string[] | undefined>;
function get(input: HeaderInput, key: string): string | null {
  const value = 'get' in input && typeof input.get === 'function' ? input.get(key) : (input as Record<string, string | string[] | undefined>)[key];
  return typeof value === 'string' ? value : null;
}
export function primaryOrigin(): string { return new URL(process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br').origin; }
export function domainFeatureEnabled(): boolean { return process.env.CRM_CUSTOM_DOMAINS_ENABLED === 'true'; }
export async function resolveRequestDomain(input: HeaderInput): Promise<DomainContext> {
  const primary = new URL(primaryOrigin());
  const authority = get(input, 'host');
  if (!authority || /[\s\\/@?#%,]/.test(authority)) return { kind: 'denied' };
  let url: URL;
  try { url = new URL('https://' + authority); } catch { return { kind: 'denied' }; }
  if (url.hostname.replace(/\.$/, '').toLowerCase() === primary.hostname.toLowerCase()
    && new URL(primary.protocol + '//' + authority).port === primary.port) {
    // Never use X-Forwarded-Host to choose an organization or a redirect.
    return { kind: 'primary', origin: primary.origin };
  }
  if (!domainFeatureEnabled()) return { kind: 'denied' };
  let hostname: string;
  try { hostname = normalizeDomain(url.hostname); } catch { return { kind: 'denied' }; }
  if (url.port && url.port !== '443') return { kind: 'denied' };
  const secret = proxySecret(), supplied = get(input, 'x-crm-proxy-key');
  if (!secret || !supplied || !sameSecret(supplied, secret) || get(input, 'x-forwarded-proto') !== 'https') return { kind: 'denied' };
  const forwarded = get(input, 'x-forwarded-host');
  if (forwarded) {
    try {
      if (/[\s\\/@?#%,]/.test(forwarded)) return { kind: 'denied' };
      const forwardedUrl = new URL('https://' + forwarded);
      if (normalizeDomain(forwardedUrl.hostname) !== hostname || forwardedUrl.port && forwardedUrl.port !== '443') return { kind: 'denied' };
    } catch { return { kind: 'denied' }; }
  }
  const matches = await prisma.organization.findMany({
    where: { domain: { equals: hostname, mode: 'insensitive' } }, take: 2,
    select: { id: true, domain: true, plan: true, features: true, settings: true, deletedAt: true },
  });
  if (matches.length !== 1) return { kind: 'denied' };
  const org = matches[0];
  if (org.deletedAt || !resolveCommercialEntitlements(org).capabilities.includes('custom_domain') || !readDomainState(org.settings)) return { kind: 'denied' };
  return { kind: 'custom', origin: 'https://' + hostname, hostname, organizationId: org.id, active: domainIsActive(org.settings) };
}
export async function requestDomain(): Promise<DomainContext> {
  try { return await resolveRequestDomain(await headers()); } catch { return { kind: 'denied' }; }
}
export function sessionMatchesDomain(token: { domainOrigin?: unknown; organizationId?: unknown; domainOrganizationId?: unknown }, context: DomainContext): boolean {
  if (context.kind === 'denied') return false;
  if (token.domainOrigin && token.domainOrganizationId !== token.organizationId) return false;
  if (context.kind === 'primary') return !token.domainOrigin || token.domainOrigin === context.origin;
  return context.active && token.domainOrigin === context.origin && token.organizationId === context.organizationId;
}
/** Only public presentation fields; no session/user inference by email or URL parameter. */
export async function publicDomainBranding() {
  if (!domainFeatureEnabled()) return null;
  const context = await requestDomain();
  if (context.kind !== 'custom' || !context.active) return null;
  const { getOrgBranding } = await import('../branding');
  return getOrgBranding(context.organizationId);
}
