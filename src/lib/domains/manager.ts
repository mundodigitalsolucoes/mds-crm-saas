import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { resolveCommercialEntitlements } from '../entitlements/resolver';
import { parseCommercialFeatures } from '../entitlements/features';
import { DOMAIN_SETTINGS_KEY, readSettings, readDomainState, domainIsActive, normalizeDomain, type DomainCommand, type DomainState } from './model';
import { verifyDomainNetwork, type ProbeResult } from './network';

export class DomainError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
export function domainView(org: { domain: string | null; features: string; settings: string; id: string; plan: string }) {
  const state = readDomainState(org.settings);
  const eligible = resolveCommercialEntitlements(org).capabilities.includes('custom_domain');
  const expired = !!state?.verifiedUntil && Date.parse(state.verifiedUntil) <= Date.now();
  return { hostname: org.domain, eligible, status: !org.domain ? 'unconfigured' : !eligible ? 'disabled' : expired && ['active', 'verified'].includes(state?.status || '') ? 'awaiting_https' : state?.status || 'error',
    challenge: state?.challenge ?? null, error: state?.error ?? null,
    verifiedUntil: state?.verifiedUntil ?? null, certificateExpiresAt: state?.certificateExpiresAt ?? null,
    verificationExpired: !!state?.verifiedUntil && Date.parse(state.verifiedUntil) <= Date.now(),
    dns: org.domain && state ? { txtName: '_mds-crm-verification.' + org.domain, txtValue: 'mds-crm=' + state.challenge,
      cnameTarget: new URL(process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br').hostname } : null };
}
export function createDomainManager(db: PrismaClient, probe: (hostname: string, challenge: string) => Promise<ProbeResult> = verifyDomainNetwork) {
  return async (id: string, actorId: string, command: DomainCommand) => {
    const org = await db.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt) throw new DomainError(404, 'ORGANIZATION_UNAVAILABLE');
    let settings: Record<string, unknown>;
    try { settings = readSettings(org.settings); } catch { throw new DomainError(409, 'SETTINGS_REQUIRE_REVIEW'); }
    const oldState = readDomainState(org.settings);
    let state: DomainState | null = oldState, domain = org.domain, features = org.features;
    if (command.action === 'grant') {
      const parsed = parseCommercialFeatures(org.features);
      if (!['valid', 'empty'].includes(parsed.status)) throw new DomainError(409, 'CONTRACT_REQUIRE_REVIEW');
      const previous = JSON.parse(org.features) as string[];
      features = JSON.stringify(command.enabled ? (previous.includes('custom_domain') ? previous : [...previous, 'custom_domain']) : previous.filter(value => value !== 'custom_domain'));
      if (!command.enabled && state) state = { ...state, status: 'disabled' };
    } else {
      if (!['deactivate', 'remove'].includes(command.action) && !resolveCommercialEntitlements(org).capabilities.includes('custom_domain')) throw new DomainError(403, 'CUSTOM_DOMAIN_NOT_CONTRACTED');
      if (command.action === 'configure') {
        domain = normalizeDomain(command.hostname);
        if (domain === new URL(process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br').hostname) throw new DomainError(409, 'PRIMARY_DOMAIN_RESERVED');
        state = { status: 'awaiting_dns', challenge: randomBytes(32).toString('hex'), revision: randomUUID() };
      } else if (command.action === 'remove') { domain = null; state = null; }
      else {
        if (!domain || !state) throw new DomainError(409, 'DOMAIN_NOT_CONFIGURED');
        if (command.action === 'deactivate') state = { ...state, status: 'disabled' };
        if (command.action === 'verify') {
          const result = await probe(domain, state.challenge);
          const checkedAt = new Date().toISOString();
          state = result.ok ? { ...state, status: domainIsActive(org.settings) ? 'active' : 'verified', error: undefined, checkedAt,
            certificateExpiresAt: result.certificateExpiresAt,
            verifiedUntil: new Date(Math.min(Date.parse(result.certificateExpiresAt), Date.now() + 86400000)).toISOString() }
            : { ...state, status: result.status, error: result.error, checkedAt, verifiedUntil: undefined, certificateExpiresAt: undefined };
        }
        if (command.action === 'activate') {
          if (!['verified', 'active'].includes(state.status) || !state.verifiedUntil || Date.parse(state.verifiedUntil) <= Date.now()
            || !state.certificateExpiresAt || Date.parse(state.certificateExpiresAt) <= Date.now()) throw new DomainError(409, 'DOMAIN_NOT_VERIFIED');
          state = { ...state, status: 'active' };
        }
      }
    }
    if (state) settings[DOMAIN_SETTINGS_KEY] = state; else delete settings[DOMAIN_SETTINGS_KEY];
    try {
      const updated = await db.$transaction(async tx => {
        if (domain) {
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${domain.toLowerCase()}, 0))`;
          const conflict = await tx.organization.findFirst({ where: { id: { not: id }, domain: { equals: domain, mode: 'insensitive' } }, select: { id: true } });
          if (conflict) throw new DomainError(409, 'DOMAIN_ALREADY_RESERVED');
        }
        const changed = await tx.organization.updateMany({ where: { id, deletedAt: null, settings: org.settings, domain: org.domain, features: org.features },
          data: { domain, features, settings: JSON.stringify(settings) } });
        if (changed.count !== 1) throw new DomainError(409, 'CONCURRENT_CONFIGURATION_CHANGE');
        await tx.activity.create({ data: { entityType: 'organization', entityId: id, action: 'updated', userId: null,
          description: 'Domínio próprio administrado pela MDS', metadata: JSON.stringify({ actorType: 'superadmin', actorId,
            action: command.action, previousHostname: org.domain, hostname: domain, status: state?.status ?? 'unconfigured' }) } });
        return tx.organization.findUniqueOrThrow({ where: { id }, select: { id: true, domain: true, plan: true, features: true, settings: true } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return domainView(updated);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new DomainError(409, 'CONCURRENT_DOMAIN_CONFLICT');
      throw new DomainError(503, 'DOMAIN_UPDATE_UNAVAILABLE');
    }
  };
}
