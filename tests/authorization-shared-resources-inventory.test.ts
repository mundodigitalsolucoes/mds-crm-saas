import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = [
  ['agenda/route.ts', 'agenda'],
  ['agenda/[id]/route.ts', 'agenda'],
  ['tasks/route.ts', 'tasks'],
  ['tasks/[id]/route.ts', 'tasks'],
  ['tasks/[id]/subtasks/route.ts', 'tasks'],
  ['tasks/[id]/subtasks/[subtaskId]/route.ts', 'tasks'],
  ['goals/route.ts', 'goals'],
  ['goals/[id]/route.ts', 'goals'],
  ['goals/[id]/actions/route.ts', 'goals'],
  ['goals/[id]/actions/[actionId]/route.ts', 'goals'],
  ['tags/[id]/route.ts', 'leads'],
] as const;

test('shared resource handlers retain operational permission boundaries', () => {
  for (const [path, permission] of shared) {
    const source = readFileSync(`src/app/api/${path}`, 'utf8');
    assert.ok(source.includes('checkPermission('), `missing permission: ${path}`);
    assert.ok(source.includes(`'${permission}'`), `wrong permission: ${path}`);
    assert.doesNotMatch(source, /checkModulePermission\(\{\s*module: '(?:atendimento|marketing|vendas)'/,
      `shared resource must not be reassigned without policy: ${path}`);
  }
});

test('notifications retain authenticated identity instead of invented commercial ownership', () => {
  for (const path of ['notifications/route.ts', 'notifications/read/route.ts']) {
    const source = readFileSync(`src/app/api/${path}`, 'utf8');
    assert.match(source, /getServerSession|checkPermission/);
    assert.doesNotMatch(source, /checkModulePermission/);
  }
});
