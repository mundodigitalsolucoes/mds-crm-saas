import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const observed = {
  whatsapp: ['canais/connect', 'canais/whatsapp-cloud/connect', 'canais/whatsapp-cloud/delete'],
  email_channel: ['canais/email', 'canais/email/google/authorize'],
  instagram_channel: ['instagram', 'instagram/accounts', 'instagram/connect', 'instagram/create-inbox',
    'instagram/debug-business-pages', 'instagram/debug-pages', 'instagram/debug-token',
    'instagram/exchange-token', 'instagram/select-account', 'instagram/subscribe-page', 'instagram/sync-account'],
  site_widget: ['widget', 'widget/agents', 'widget/provision'],
} as const;

test('all reviewed human-facing channel APIs keep operational authorization and observe the matching commercial channel', () => {
  for (const [channel, routes] of Object.entries(observed)) {
    for (const route of routes) {
      const source = readFileSync(`src/app/api/atendimento/${route}/route.ts`, 'utf8');
      assert.match(source, /checkPermission\s*\(/, `missing operational guard: ${route}`);
      assert.ok(source.includes(`observeChannelEntitlement(`), `missing observation: ${route}`);
      assert.ok(source.includes(`'${channel}'`), `wrong channel: ${route}`);
      assert.ok(source.search(/checkPermission\s*\(/) < source.indexOf('observeChannelEntitlement('),
        `observation must follow operational guard: ${route}`);
    }
  }
});

test('Meta token exchange never trusts organizationId supplied in request body', () => {
  const source = readFileSync('src/app/api/atendimento/instagram/exchange-token/route.ts', 'utf8');
  assert.ok(source.includes("checkPermission('integrations', 'edit')"));
  assert.ok(source.includes('organizationId !== trustedOrganizationId'));
  assert.ok(source.includes('where: { id: trustedOrganizationId, deletedAt: null }'));
  assert.ok(source.includes('settings: organization.settings'));
  assert.ok(source.includes('saved.count !== 1'));
  assert.doesNotMatch(source, /\{ error: 'Erro interno', details: error \}/);
});

test('provider callbacks remain outside human session authorization', () => {
  for (const route of ['instagram/callback', 'instagram/webhook']) {
    const source = readFileSync(`src/app/api/atendimento/${route}/route.ts`, 'utf8');
    assert.doesNotMatch(source, /observeChannelEntitlement|checkModulePermission/);
  }
});
