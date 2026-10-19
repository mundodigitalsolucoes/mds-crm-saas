import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCommercialChannelAccess } from '../src/lib/entitlements/channel-access';
import type { ChannelId } from '../src/lib/entitlements/catalog';

const org = (features: unknown, id = 'org-a') => ({ id, plan: 'custom', features });
const check = (features: unknown, channel: ChannelId = 'whatsapp') =>
  evaluateCommercialChannelAccess(org(features), channel);

test('channel access requires both Atendimento module and explicit channel', () => {
  assert.deepEqual(check('["atendimento","whatsapp"]'), { allowed: true, reason: 'allowed' });
  assert.equal(check('["whatsapp"]').reason, 'module_not_contracted');
  assert.equal(check('["atendimento"]').reason, 'channel_not_contracted');
  assert.equal(check('["atendimento","instagram_channel"]', 'whatsapp').reason, 'channel_not_contracted');
});

test('channels remain distinct and provider-neutral', () => {
  const features = '["atendimento","whatsapp","email_channel"]';
  assert.equal(check(features, 'email_channel').allowed, true);
  assert.equal(check(features, 'site_widget').reason, 'channel_not_contracted');
  assert.equal(check(features, 'instagram_channel').reason, 'channel_not_contracted');
});

test('invalid, missing or unknown feature declarations never grant a channel', () => {
  for (const raw of [null, '', '[]', '{}', '{', '["atendimento","whatsapp",1]', '["atendimento","whatsapp","unknown"]']) {
    assert.equal(check(raw).allowed, false);
  }
});

test('same plan does not transfer commercial channel rights between tenants', () => {
  const a = evaluateCommercialChannelAccess(org('["atendimento","whatsapp"]', 'org-a'), 'whatsapp');
  const b = evaluateCommercialChannelAccess(org('["atendimento","email_channel"]', 'org-b'), 'whatsapp');
  assert.equal(a.allowed, true);
  assert.equal(b.allowed, false);
});

test('commercial channel result is not an operational permission or an enforcement switch', () => {
  const result = check('["atendimento","whatsapp"]');
  assert.deepEqual(result, { allowed: true, reason: 'allowed' });
  assert.equal('session' in result, false);
  assert.equal('enforcementEnabled' in result, false);
});
