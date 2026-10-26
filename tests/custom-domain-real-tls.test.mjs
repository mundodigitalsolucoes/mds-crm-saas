import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as https from 'node:https';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import * as crypto from 'node:crypto';
import { loadHandler } from './helpers/load-disposable-handler.mjs';

// Real TLS; only the transport maps the approved fixture IP/port to loopback and
// trusts a freshly generated fixture CA. Production SSRF/TLS checks stay intact.
test('real TLS: repeated pinned verification survives server connection close for two tenants, without resumed-session certificate loss', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mds-domain-tls-'));
  const hosts = ['crm.customer.example.com', 'crm.other.example.com'];
  const secret = 'synthetic-tls-only-'.repeat(4), challenge = 'a'.repeat(64);
  let server;
  try {
    const openssl = (...args) => execFileSync('openssl', args, { cwd: directory, stdio: 'pipe' });
    openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2', '-subj', '/CN=Synthetic-Domain-Test-CA');
    openssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=' + hosts[0]);
    writeFileSync(join(directory, 'extensions.cnf'), 'subjectAltName=' + hosts.map(host => 'DNS:' + host).join(',') + '\nextendedKeyUsage=serverAuth\n');
    openssl('x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.pem', '-days', '1', '-extfile', 'extensions.cnf');
    let network, requests = 0; const connections = [], lookups = [];
    server = https.createServer({ key: readFileSync(join(directory, 'server.key')), cert: readFileSync(join(directory, 'server.pem')) }, (req, res) => {
      requests++;
      const host = req.headers.host.split(':')[0], nonce = new URL(req.url, 'https://' + host).searchParams.get('nonce');
      assert.ok(hosts.includes(host));
      res.setHeader('Connection', 'close'); // Next probe must open another TCP/TLS connection.
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ proof: network.routingProof(secret, host, challenge, nonce) }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    network = loadHandler('src/lib/domains/network.ts', {
      'node:dns/promises': dns, 'node:net': net, 'node:crypto': crypto,
      'node:https': { request: (options, callback) => {
        assert.equal(options.port, 443); assert.equal(options.rejectUnauthorized, true);
        assert.equal(options.servername, options.hostname);
        assert.deepEqual(Object.keys(options.headers), ['User-Agent']);
        return https.request({ ...options, port, ca: readFileSync(join(directory, 'ca.pem')),
          lookup: (host, config, done) => options.lookup(host, config, (error, address, family) => {
            lookups.push({ all: !!config.all });
            if (config.all) {
              assert.deepEqual(JSON.parse(JSON.stringify(address)), [{ address: '8.8.8.8', family: 4 }]);
              done(error, [{ address: '127.0.0.1', family: 4 }]);
            } else { assert.equal(address, '8.8.8.8'); assert.equal(family, 4); done(error, '127.0.0.1', 4); }
          }),
        }, response => {
          connections.push({ resumed: response.socket.isSessionReused(), authorized: response.socket.authorized, certificatePresent: !!response.socket.getPeerCertificate().valid_to });
          callback(response);
        });
      } },
    });
    for (const hostname of hosts) {
      const probe = network.createDomainProbe({ txt: async () => [['mds-crm=' + challenge]], addresses: async () => ['8.8.8.8'], ipv6: async () => [], https: network.pinnedHttpsProbe }, ['8.8.8.8'], secret);
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await probe(hostname, challenge);
        assert.equal(result.ok, true, 'Every valid TLS/routing proof must pass, including after the first connection');
        assert.ok(Date.parse(result.certificateExpiresAt) > Date.now());
      }
    }
    assert.equal(requests, 10); assert.equal(connections.length, 10);
    assert.ok(connections.every(item => item.authorized && item.certificatePresent && !item.resumed));
    assert.ok(lookups.length >= 10);
    // The same real TLS adapter still refuses a certificate for another hostname.
    await assert.rejects(network.pinnedHttpsProbe('wrong.customer.example.com', '8.8.8.8', 'c'.repeat(64)), error => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID');
    assert.equal(requests, 10, 'Rejected TLS cannot reach HTTP or return a proof');
    const before = lookups.length;
    await assert.rejects(network.pinnedHttpsProbe(hosts[0], '127.0.0.1', 'c'.repeat(64)), /UNSAFE_ADDRESS/);
    assert.equal(lookups.length, before, 'SSRF rejection occurs before opening the connection');
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    rmSync(directory, { recursive: true, force: true });
  }
});
