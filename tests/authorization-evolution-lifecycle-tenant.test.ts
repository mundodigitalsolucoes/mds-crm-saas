import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lifecycle = readFileSync('src/lib/atendimento/orchestration/channel-lifecycle.ts', 'utf8');

test('Evolution lifecycle resource lookups scope requested instance IDs to tenant', () => {
  for (const fn of ['reconnectWhatsappChannel', 'finalizeWhatsappChannel', 'disconnectWhatsappChannel', 'deleteWhatsappChannel']) {
    const start = lifecycle.indexOf(`export async function ${fn}(`);
    assert.ok(start >= 0, `missing lifecycle operation: ${fn}`);
    const end = lifecycle.indexOf('export async function ', start + 22);
    const body = lifecycle.slice(start, end < 0 ? undefined : end);
    assert.match(body, /prisma\.whatsappInstance\.findFirst\(/, `missing scoped lookup: ${fn}`);
    assert.match(body, /id: instanceId,\s*organizationId/, `tenant ownership not enforced: ${fn}`);
  }
});

test('Evolution lifecycle routes take organization from trusted session', () => {
  for (const operation of ['connect', 'reconnect', 'finalize', 'disconnect', 'delete']) {
    const source = readFileSync(`src/app/api/integrations/evolution/${operation}/route.ts`, 'utf8');
    assert.match(source, /checkPermission\('integrations', 'edit'\)/);
    assert.match(source, /session!\.user\.organizationId/);
  }
});
