import { Resolver } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DomainState } from './model';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(address, prefix, 'ipv4');
export function publicIPv4(ip: string): boolean { return isIP(ip) === 4 && !blocked.check(ip, 'ipv4'); }
export function proxySecret(): string | null {
  const value = process.env.CRM_CUSTOM_DOMAIN_PROXY_SECRET;
  return value && value.length >= 48 ? value : null;
}
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function routingProof(secret: string, hostname: string, challenge: string, nonce: string): string {
  return createHmac('sha256', secret).update(JSON.stringify([hostname, challenge, nonce])).digest('hex');
}
export type ProbeResult = { ok: true; certificateExpiresAt: string } | { ok: false; status: 'awaiting_dns' | 'awaiting_https'; error: NonNullable<DomainState['error']> };
export interface NetworkDependencies {
  txt: (host: string) => Promise<string[][]>;
  addresses: (host: string) => Promise<string[]>;
  ipv6?: (host: string) => Promise<string[]>;
  https: (hostname: string, pinnedIp: string, nonce: string) => Promise<{ proof: string; certificateExpiresAt: string }>;
}
/** Only pinned public IPs explicitly controlled by MDS; no redirects or arbitrary ports. */
export function pinnedHttpsProbe(hostname: string, pinnedIp: string, nonce: string): ReturnType<NetworkDependencies['https']> {
  if (!publicIPv4(pinnedIp)) return Promise.reject(Error('UNSAFE_ADDRESS'));
  return new Promise((accept, reject) => {
    const req = request({ hostname, port: 443, servername: hostname, method: 'GET',
      path: '/.well-known/mds-crm-domain-check?nonce=' + nonce,
      lookup: (_host, options, callback) => options.all ? callback(null, [{ address: pinnedIp, family: 4 }]) : callback(null, pinnedIp, 4),
      rejectUnauthorized: true, timeout: 5000, headers: { 'User-Agent': 'MDS-Domain-Verification/1' },
    }, response => {
      if (response.statusCode !== 200 || response.headers.location) { response.destroy(); reject(Error('ROUTING_UNAVAILABLE')); return; }
      const socket = response.socket as import('node:tls').TLSSocket;
      const expires = socket.getPeerCertificate().valid_to;
      let size = 0; const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 4096) { response.destroy(); reject(Error('RESPONSE_LIMIT')); } else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { proof?: unknown };
          if (typeof body.proof !== 'string' || !expires || !socket.authorized) throw Error('INVALID_PROOF');
          accept({ proof: body.proof, certificateExpiresAt: new Date(expires).toISOString() });
        } catch (error) { reject(error); }
      });
    });
    req.once('timeout', () => req.destroy(Error('PROBE_TIMEOUT')));
    req.once('error', reject); req.end();
  });
}
export function createDomainProbe(deps: NetworkDependencies, ingress: readonly string[], secret: string | null) {
  return async (hostname: string, challenge: string): Promise<ProbeResult> => {
    if (!secret || !ingress.length || !ingress.every(publicIPv4)) return { ok: false, status: 'awaiting_https', error: 'configuration_missing' };
    try {
      const records = await deps.txt('_mds-crm-verification.' + hostname);
      if (!records.some(parts => parts.join('') === 'mds-crm=' + challenge)) return { ok: false, status: 'awaiting_dns', error: 'ownership_missing' };
      const addresses = await deps.addresses(hostname);
      if (deps.ipv6 && (await deps.ipv6(hostname)).length) return { ok: false, status: 'awaiting_dns', error: 'pointing_mismatch' };
      if (!addresses.length || !addresses.every(ip => publicIPv4(ip) && ingress.includes(ip))) return { ok: false, status: 'awaiting_dns', error: 'pointing_mismatch' };
      const nonce = randomBytes(32).toString('hex');
      try {
        const result = await deps.https(hostname, addresses[0], nonce);
        if (!sameSecret(result.proof, routingProof(secret, hostname, challenge, nonce))) return { ok: false, status: 'awaiting_https', error: 'routing_mismatch' };
        if (Date.parse(result.certificateExpiresAt) <= Date.now() + 60000 || !Number.isFinite(Date.parse(result.certificateExpiresAt))) throw Error('EXPIRED_CERTIFICATE');
        return { ok: true, certificateExpiresAt: result.certificateExpiresAt };
      } catch { return { ok: false, status: 'awaiting_https', error: 'https_unavailable' }; }
    } catch { return { ok: false, status: 'awaiting_dns', error: 'dns_unavailable' }; }
  };
}
const dns = new Resolver({ timeout: 2000, tries: 1 });
export const verifyDomainNetwork = (hostname: string, challenge: string) => createDomainProbe(
  { txt: host => dns.resolveTxt(host), addresses: host => dns.resolve4(host), ipv6: async host => {
    try { return await dns.resolve6(host); } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && ['ENODATA', 'ENOTFOUND'].includes(String(error.code))) return [];
      throw error;
    }
  }, https: pinnedHttpsProbe },
  (process.env.CRM_CUSTOM_DOMAIN_INGRESS_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean), proxySecret(),
)(hostname, challenge);
