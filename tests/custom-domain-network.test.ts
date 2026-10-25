import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomainProbe, publicIPv4, routingProof, pinnedHttpsProbe } from '../src/lib/domains/network';
import { normalizeDomain, domainCommandSchema } from '../src/lib/domains/model';

const secret = 'fixture-only-'.repeat(6), challenge = 'a'.repeat(64), hostname = 'crm.customer.example.com';
const expires = new Date(Date.now() + 86400000 * 30).toISOString();
for (const value of ['127.0.0.1','10.1.1.1','169.254.169.254','100.64.0.1','172.16.0.1','192.168.1.1','198.51.100.1','::1','::ffff:127.0.0.1','224.0.0.1']) {
  test('SSRF address refused: '+value, async () => {
    assert.equal(publicIPv4(value), false);
    await assert.rejects(pinnedHttpsProbe(hostname, value, 'a'.repeat(64)), /UNSAFE_ADDRESS/);
  });
}
for (const input of ['https://example.com','user@example.com','example.com:443','evil.com/path','//evil.com','a..example.com','localhost','crm.local','127.0.0.1','example.com,evil.com','example.com\n','*.example.com']) {
  test('hostname syntax refused: '+JSON.stringify(input), () => {
    assert.throws(() => normalizeDomain(input));
    assert.equal(domainCommandSchema.safeParse({ action: 'configure', hostname: input }).success, false);
  });
}
test('hostname is exact canonical IDNA, not a substring or URL', () => {
  assert.equal(normalizeDomain('CRM.Example.COM.'), 'crm.example.com');
  assert.equal(normalizeDomain('crm.exâmple.com'), 'crm.xn--exmple-xta.com');
  assert.equal(domainCommandSchema.safeParse({ action: 'activate', organizationId: 'another' }).success, false);
});
test('DNS/TLS verification requires ownership, public pinned routing, certificate and CRM proof', async () => {
  let tlsCalls = 0;
  const deps = { txt: async () => [['mds-crm='+challenge]], addresses: async () => ['8.8.8.8'],
    https: async (host: string, ip: string, nonce: string) => {
      tlsCalls++; assert.equal(host, hostname); assert.equal(ip, '8.8.8.8');
      return { proof: routingProof(secret, host, challenge, nonce), certificateExpiresAt: expires };
    } };
  assert.deepEqual(await createDomainProbe(deps, ['8.8.8.8'], secret)(hostname, challenge), { ok: true, certificateExpiresAt: expires });
  assert.equal(tlsCalls, 1);
  assert.equal((await createDomainProbe({ ...deps, txt: async () => [] }, ['8.8.8.8'], secret)(hostname, challenge)).ok, false);
  assert.equal(tlsCalls, 1, 'No TLS before DNS ownership');
  assert.equal((await createDomainProbe({ ...deps, addresses: async () => ['127.0.0.1'] }, ['8.8.8.8'], secret)(hostname, challenge)).ok, false);
  assert.equal(tlsCalls, 1, 'Private address never reaches network adapter');
  assert.equal((await createDomainProbe({ ...deps, addresses: async () => ['9.9.9.9'] }, ['8.8.8.8'], secret)(hostname, challenge)).ok, false);
  assert.equal(tlsCalls, 1, 'Only explicitly authorized ingress IPs');
  assert.equal((await createDomainProbe({ ...deps, ipv6: async () => ['2001:db8::1'] }, ['8.8.8.8'], secret)(hostname, challenge)).ok, false);
  assert.equal(tlsCalls, 1, 'Unexpected AAAA never receives verification approval');
  assert.equal((await createDomainProbe(deps, ['8.8.8.8'], null)(hostname, challenge)).ok, false);
  assert.equal(tlsCalls, 1, 'No network with incomplete trusted-proxy configuration');
  for (const certificateExpiresAt of ['invalid', new Date(0).toISOString()]) {
    assert.equal((await createDomainProbe({ ...deps, https: async (host, _ip, nonce) => ({ proof: routingProof(secret, host, challenge, nonce), certificateExpiresAt }) }, ['8.8.8.8'], secret)(hostname, challenge)).ok, false);
  }
  const wrongProof = await createDomainProbe({ ...deps, https: async () => ({ proof: '0'.repeat(64), certificateExpiresAt: expires }) }, ['8.8.8.8'], secret)(hostname, challenge);
  assert.deepEqual(wrongProof, { ok: false, status: 'awaiting_https', error: 'routing_mismatch' });
  const noTLS = await createDomainProbe({ ...deps, https: async () => { throw Error('bad certificate / redirect / unreachable'); } }, ['8.8.8.8'], secret)(hostname, challenge);
  assert.deepEqual(noTLS, { ok: false, status: 'awaiting_https', error: 'https_unavailable' });
});
