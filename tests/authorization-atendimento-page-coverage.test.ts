import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Atendimento and all nested settings pages inherit a server commercial page observation', () => {
  for (const path of ['atendimento/layout.tsx', 'settings/atendimento/layout.tsx']) {
    const source = readFileSync(`src/app/(app)/${path}`, 'utf8');
    assert.match(source, /checkModulePage\s*\(\s*\{\s*module:\s*'atendimento',\s*permission:\s*'atendimento',\s*action:\s*'view'/);
    assert.match(source, /await checkModulePage/);
  }
});

test('page commercial guard remains observe-only unless tenant enforcement is approved', () => {
  const policy = readFileSync('src/lib/authorization/policy.ts', 'utf8');
  assert.match(policy, /APPROVED_ENFORCEMENTS/);
  const page = readFileSync('src/lib/authorization/page.ts', 'utf8');
  assert.match(page, /if \(!block\) return/);
});
