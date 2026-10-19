import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'src/app/api/atendimento';
function routes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? routes(path) : entry.name === 'route.ts' ? [path] : [];
  });
}
function methods(source: string) {
  return [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)].map((match) => match[1]);
}
test('inventory every Atendimento API handler and explicitly classify provider callbacks', () => {
  const files = routes(root);
  assert.ok(files.length >= 29, 'Atendimento API inventory unexpectedly shrank');
  const callbackRoutes = new Set([
    'instagram/webhook/route.ts', 'instagram/callback/route.ts',
  ]);
  const results = files.map((file) => {
    const source = readFileSync(file, 'utf8');
    const path = relative(root, file).replaceAll('\\', '/');
    const actions = methods(source);
    assert.ok(actions.length, `no HTTP handler found in ${path}`);
    const classification = callbackRoutes.has(path) ? 'provider_callback' : 'operational_or_provider_setup';
    const legacy = /\bcheckPermission\s*\(/.test(source);
    const commercial = /\bcheckModulePermission\s*\(/.test(source);
    return { path, actions, classification, legacy, commercial };
  });
  for (const path of callbackRoutes) {
    assert.ok(results.some((row) => row.path === path && row.classification === 'provider_callback'));
  }
  assert.ok(results.some((row) => row.path === 'equipes/route.ts' && row.commercial && !row.legacy));
  assert.ok(results.some((row) => row.path === 'canais/email/route.ts' && row.legacy && !row.commercial));
  for (const path of [
    'inboxes/route.ts', 'agentes/route.ts', 'agentes/sync/route.ts',
    'equipes/[teamId]/route.ts', 'equipes/[teamId]/members/route.ts',
    'inboxes/[inboxId]/members/route.ts',
  ]) {
    assert.ok(results.some((row) => row.path === path && row.commercial && !row.legacy), `commercial guard missing: ${path}`);
  }
  // Report gaps without granting access or requiring all providers to use a human session.
  console.info('BLOCK2_ATENDIMENTO_ROUTE_INVENTORY', JSON.stringify(results));
});
