import { domainToASCII } from 'node:url';
import { isIP } from 'node:net';
import { z } from 'zod';

export const DOMAIN_SETTINGS_KEY = 'customDomainV1';
export const domainStateSchema = z.object({
  status: z.enum(['awaiting_dns', 'awaiting_https', 'verified', 'active', 'disabled', 'error']),
  challenge: z.string().regex(/^[0-9a-f]{64}$/),
  revision: z.string().uuid(),
  verifiedUntil: z.string().datetime().optional(),
  certificateExpiresAt: z.string().datetime().optional(),
  checkedAt: z.string().datetime().optional(),
  verifiedAt: z.string().datetime().optional(),
  activatedAt: z.string().datetime().optional(),
  activationRevision: z.string().uuid().optional(),
  activationHostname: z.string().refine(value => { try { return normalizeDomain(value) === value; } catch { return false; } }).optional(),
  error: z.enum(['dns_unavailable', 'ownership_missing', 'pointing_mismatch', 'https_unavailable', 'routing_mismatch', 'configuration_missing']).optional(),
}).strict();
export type DomainState = z.infer<typeof domainStateSchema>;
export function normalizeDomain(input: string): string {
  if (!input || input !== input.trim() || /[\s\\/@:#?%\u0000-\u0020]/.test(input)) throw Error('INVALID_DOMAIN');
  const host = domainToASCII(input.replace(/\.$/, '')).toLowerCase();
  if (!host || host.length > 253 || isIP(host) || !host.includes('.') || /\.(localhost|local|internal|test|invalid|example)$/.test(host)) throw Error('INVALID_DOMAIN');
  if (!host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw Error('INVALID_DOMAIN');
  return host;
}
export function readSettings(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw);
  if (!value || Array.isArray(value) || typeof value !== 'object') throw Error('INVALID_SETTINGS');
  return value as Record<string, unknown>;
}
export function readDomainState(raw: string): DomainState | null {
  try { const result = domainStateSchema.safeParse(readSettings(raw)[DOMAIN_SETTINGS_KEY]); return result.success ? result.data : null; }
  catch { return null; }
}
/** Proof timestamps describe an observed validation, not the lifetime of activation. */
export function hasDomainVerification(state: DomainState, now = Date.now()): boolean {
  const verified = Date.parse(state.verifiedAt || state.checkedAt || '');
  const certificate = Date.parse(state.certificateExpiresAt || '');
  const validity = Date.parse(state.verifiedUntil || '');
  return Number.isFinite(verified) && verified <= now && Number.isFinite(certificate) && certificate > verified
    && Number.isFinite(validity) && validity > verified;
}
export function domainIsActive(raw: string, now = Date.now(), hostname?: string): boolean {
  const state = readDomainState(raw);
  if (!state || state.status !== 'active' || !hasDomainVerification(state, now)) return false;
  const stamped = !!(state.activatedAt || state.activationRevision || state.activationHostname);
  if (!stamped) return true; // V1: already activated, with evidence of its initial verification.
  return !!state.activatedAt && Date.parse(state.activatedAt) <= now
    && state.activationRevision === state.revision && !!state.activationHostname
    && (!hostname || state.activationHostname === hostname);
}
export const domainCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal('configure'), hostname: z.string().max(254).refine(value => { try { normalizeDomain(value); return true; } catch { return false; } }, 'Informe somente um hostname público válido').transform(normalizeDomain) }).strict(),
  ...(['verify', 'activate', 'deactivate', 'remove'] as const).map(action => z.object({ action: z.literal(action) }).strict()),
]);
export type DomainCommand = z.infer<typeof domainCommandSchema>;
