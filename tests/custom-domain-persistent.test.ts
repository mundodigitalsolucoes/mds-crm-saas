import test from 'node:test';
import assert from 'node:assert/strict';
import { domainIsActive, type DomainState } from '../src/lib/domains/model';
const now = Date.now();
const proof: DomainState = { status: 'active', challenge: 'a'.repeat(64), revision: '981d25db-6d8c-4b37-a036-26c4b4b792cc', checkedAt: new Date(now-3*86400000).toISOString(), verifiedUntil: new Date(now-2*86400000).toISOString(), certificateExpiresAt: new Date(now-86400000).toISOString() };
const settings = (state: unknown) => JSON.stringify({ customDomainV1: state });
test('legacy activation persists after 24h and after the observed certificate date; current TLS remains a proxy responsibility', () => {
  assert.equal(domainIsActive(settings(proof), now), true);
  assert.equal(domainIsActive(settings(proof), now+100*86400000), true);
});
for (const status of ['awaiting_dns','awaiting_https','verified','disabled','error']) {
  test('record presence and '+status+' never authorize a hostname', () => assert.equal(domainIsActive(settings({ ...proof, status }), now), false));
}
test('active without initial proof, with invalid chronology or future proof fails closed', () => {
  for (const patch of [{checkedAt:undefined}, {verifiedUntil:undefined}, {certificateExpiresAt:undefined}, {verifiedUntil:proof.checkedAt}, {checkedAt:new Date(now+86400000).toISOString()}]) assert.equal(domainIsActive(settings({...proof,...patch}),now),false);
});
test('new activation is bound to the verified revision and hostname; incomplete stamps cannot use legacy fallback', () => {
  const state = { ...proof, activatedAt: new Date(now-1000).toISOString(), activationRevision: proof.revision, activationHostname: 'crm.customer.example.com' };
  assert.equal(domainIsActive(settings(state),now,'crm.customer.example.com'),true);
  assert.equal(domainIsActive(settings(state),now,'other.customer.example.com'),false);
  assert.equal(domainIsActive(settings({...state,activationRevision:'4f665d72-41ea-4b2e-8fcb-988c46bbd342'}),now),false);
  assert.equal(domainIsActive(settings({...state,activationHostname:undefined}),now),false);
  assert.equal(domainIsActive(settings({...state,activatedAt:new Date(now+1000).toISOString()}),now),false);
});
