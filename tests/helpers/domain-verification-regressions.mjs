import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { Resolver } from 'node:dns/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createDomainManager, domainView, DomainError } from '../../src/lib/domains/manager.ts';
import { createDomainProbe, routingProof } from '../../src/lib/domains/network.ts';
import { readDomainState, domainCommandSchema } from '../../src/lib/domains/model.ts';
import { disposableDatabaseUrl, loadHandler } from './load-disposable-handler.mjs';

// Only a loopback disposable database and a DNS server created by this test.
const db = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } });
const server = dgram.createSocket('udp4');
const resolver = new Resolver({ timeout: 1000, tries: 1 });
const ids = [], actor = randomUUID(), secret = 'synthetic-verification-only-'.repeat(3);
const hostname = 'crm-verification-fixture.example.com';
let records = [], wireQueries = 0, challengeForProof = '', httpsCalls = 0;
const expires = new Date(Date.now() + 86400000).toISOString();
server.on('message', (query, peer) => {
  wireQueries++;
  let end = 12;
  while (query[end] !== 0) end += query[end] + 1;
  end += 5;
  const answers = records.map(parts => {
    const body = Buffer.concat(parts.map(part => { const bytes = Buffer.from(part); return Buffer.concat([Buffer.from([bytes.length]), bytes]); }));
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0xc00c, 0); header.writeUInt16BE(16, 2); header.writeUInt16BE(1, 4);
    header.writeUInt32BE(300, 6); header.writeUInt16BE(body.length, 10);
    return Buffer.concat([header, body]);
  });
  const header = Buffer.alloc(12);
  query.copy(header, 0, 0, 2); header.writeUInt16BE(0x8180, 2); header.writeUInt16BE(1, 4); header.writeUInt16BE(answers.length, 6);
  server.send(Buffer.concat([header, query.subarray(12, end), ...answers]), peer.port, peer.address);
});
const probe = createDomainProbe({
  txt: host => { assert.equal(host, '_mds-crm-verification.' + hostname); return resolver.resolveTxt(host); },
  addresses: async () => ['8.8.8.8'], ipv6: async () => [],
  https: async (host, ip, nonce) => { httpsCalls++; assert.equal(ip, '8.8.8.8'); return { proof: routingProof(secret, host, challengeForProof, nonce), certificateExpiresAt: expires }; },
}, ['8.8.8.8'], secret);
before(async () => {
  await new Promise(resolve => server.bind(0, '127.0.0.1', resolve));
  resolver.setServers(['127.0.0.1:' + server.address().port]);
  await db.$connect();
});
after(async () => {
  for (const id of ids) { await db.activity.deleteMany({ where: { entityId: id } }); await db.organization.delete({ where: { id } }); }
  await db.$disconnect(); resolver.cancel(); await new Promise(resolve => server.close(resolve));
});
async function fixture() {
  const org = await db.organization.create({ data: { name: 'Synthetic verify regression', slug: 'verify-' + randomUUID(), plan: 'enterprise', features: '["vendas","custom_domain"]', settings: '{"providerSentinel":{"inbox":123}}' } });
  ids.push(org.id);
  await createDomainManager(db)(org.id, actor, { action: 'configure', hostname });
  return db.organization.findUniqueOrThrow({ where: { id: org.id } });
}
const handler = manager => loadHandler('src/app/api/admin/organizations/[id]/domain/route.ts', {
  'next/server': { NextResponse }, '@/lib/admin-auth': { verifyAdminToken: async () => ({ id: actor }) }, '@/lib/prisma': { prisma: db },
  '@/lib/domains/model': { domainCommandSchema },
  '@/lib/domains/manager': { createDomainManager: () => manager, domainView, DomainError },
});
async function verify(org, manager = createDomainManager(db, probe), body = { action: 'verify' }) {
  return handler(manager).PATCH(new Request('http://127.0.0.1/api/admin/organizations/' + org.id + '/domain', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: org.id }) });
}

test('actual PATCH rereads the stored challenge, recovers after TXT replacement in the same process and preserves provider state', async () => {
  const org = await fixture(), original = readDomainState(org.settings);
  challengeForProof = original.challenge;
  records = [['mds-crm=' + 'f'.repeat(64)]];
  const first = await verify(org); assert.equal(first.status, 200);
  const failed = await first.json(); assert.equal(failed.error, 'ownership_missing'); assert.equal(failed.status, 'awaiting_dns');
  assert.equal(httpsCalls, 0, 'No HTTPS before exact TXT match');
  const before = wireQueries;
  records = [['unrelated=fixture'], ['mds-crm=', original.challenge.slice(0, 32), original.challenge.slice(32)]];
  const response = await verify(org); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const result = await response.json(); assert.equal(result.status, 'verified'); assert.equal(result.error, null);
  assert.equal(result.challenge, original.challenge); assert.equal(result.dns.txtValue, 'mds-crm=' + original.challenge);
  assert.ok(wireQueries > before, 'A new DNS wire query follows the public TXT update');
  const saved = await db.organization.findUniqueOrThrow({ where: { id: org.id } });
  assert.equal(readDomainState(saved.settings).revision, original.revision); assert.equal(readDomainState(saved.settings).challenge, original.challenge);
  assert.ok(readDomainState(saved.settings).checkedAt); assert.deepEqual(JSON.parse(saved.settings).providerSentinel, { inbox: 123 });
  await db.organization.update({ where: { id: org.id }, data: { domain: null } });
});

test('verify uses a fresh database snapshot rather than a previous GET or a browser-supplied challenge', async () => {
  const org = await fixture(), stale = domainView(org), settings = JSON.parse(org.settings);
  const replacement = 'b'.repeat(64); assert.notEqual(stale.challenge, replacement);
  settings.customDomainV1.challenge = replacement;
  await db.organization.update({ where: { id: org.id }, data: { settings: JSON.stringify(settings) } });
  records = [['mds-crm=' + replacement]]; challengeForProof = replacement;
  const response = await verify(org); assert.equal(response.status, 200);
  assert.equal((await response.json()).challenge, replacement);
  const rejected = await verify(org, createDomainManager(db, probe), { action: 'verify', challenge: stale.challenge });
  assert.equal(rejected.status, 400);
  await db.organization.update({ where: { id: org.id }, data: { domain: null } });
});

test('concurrent settings changes reject a stale DNS result without persisting ownership_missing or overwriting configuration', async () => {
  const org = await fixture(); const changed = JSON.parse(org.settings);
  changed.providerSentinel.inbox = 456;
  const racing = createDomainManager(db, async () => {
    await db.organization.update({ where: { id: org.id }, data: { settings: JSON.stringify(changed) } });
    return { ok: false, status: 'awaiting_dns', error: 'ownership_missing' };
  });
  const response = await verify(org, racing); assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'CONCURRENT_CONFIGURATION_CHANGE');
  assert.equal((await db.organization.findUniqueOrThrow({ where: { id: org.id } })).settings, JSON.stringify(changed));
  assert.equal(await db.activity.count({ where: { entityId: org.id } }), 1, 'Only the original configure event remains');
  await db.organization.update({ where: { id: org.id }, data: { domain: null } });
});
