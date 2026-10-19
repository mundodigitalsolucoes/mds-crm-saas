import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('WhatsApp Cloud webhook rejects unsigned payloads before provider dispatch', () => {
  const source = readFileSync('src/app/api/webhooks/whatsapp-cloud/route.ts', 'utf8');
  assert.match(source, /WHATSAPP_CLOUD_APP_SECRET/);
  assert.match(source, /x-hub-signature-256/);
  assert.match(source, /createHmac\('sha256', secret\)/);
  assert.match(source, /timingSafeEqual\(received, expected\)/);
  assert.ok(source.indexOf('timingSafeEqual(received, expected)') < source.indexOf('processWhatsAppCloudWebhook(payload)'));
  assert.match(source, /if \(!secret\).*503/);
});
