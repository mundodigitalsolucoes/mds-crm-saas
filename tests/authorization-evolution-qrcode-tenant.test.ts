import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Evolution QR and status require tenant ownership before any provider request', () => {
  const source = readFileSync('src/app/api/integrations/evolution/qrcode/route.ts', 'utf8');
  assert.match(source, /checkPermission\('integrations', 'view'\)/);
  assert.match(source, /organizationId: session!\.user\.organizationId, instanceName, isActive: true/);
  assert.match(source, /if \(!ownedInstance\)/);
  const ownership = source.indexOf('const ownedInstance = await prisma.whatsappInstance.findFirst');
  for (const providerCall of ['getInstanceState(instanceName)', 'getQRCode(instanceName)']) {
    assert.ok(source.indexOf(providerCall) > ownership, `provider called before tenant check: ${providerCall}`);
  }
  assert.match(source, /provider === 'whatsapp_cloud'/);
});

test('Evolution QR does not expose tenant instance details on lookup miss', () => {
  const source = readFileSync('src/app/api/integrations/evolution/qrcode/route.ts', 'utf8');
  assert.match(source, /error: 'Instância não encontrada\.'/);
  assert.match(source, /status: 404/);
});
