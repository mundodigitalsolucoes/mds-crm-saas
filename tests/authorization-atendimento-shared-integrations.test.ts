import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = [
  'widget/route.ts',
  'widget/agents/route.ts',
  'widget/provision/route.ts',
  'canais/providers/route.ts',
  'canais/email/route.ts',
  'canais/connect/route.ts',
  'instagram/route.ts',
  'instagram/accounts/route.ts',
] as const;

test('shared integration configuration routes retain operational authorization until a reviewed commercial mapping exists', () => {
  for (const path of routes) {
    const source = readFileSync(`src/app/api/atendimento/${path}`, 'utf8');
    assert.match(source, /checkPermission\s*\(/, `legacy integration permission missing: ${path}`);
    assert.doesNotMatch(source, /checkModulePermission\s*\(\s*\{\s*module:\s*['"]atendimento['"],\s*permission:\s*['"]integrations['"]/, `invalid commercial permission pair: ${path}`);
  }
});

test('Lot2 explicitly maps integrations to Atendimento while preserving the existing operational permission', () => {
  const source = readFileSync('src/lib/authorization/authorize.ts', 'utf8');
  assert.match(source, /atendimento:\s*\['atendimento', 'integrations'\]/);
});
