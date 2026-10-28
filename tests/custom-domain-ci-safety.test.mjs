import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const script = resolve('scripts/block2-domain-ci.mjs');
for (const scenario of [
  { name: 'missing explicit CI permission', env: {}, error: 'Explicit disposable CI opt-in required' },
  { name: 'local configuration file', localFile: true, env: { CI: 'true', BLOCK2_CI_DISPOSABLE: 'true' }, error: 'Local environment files are forbidden' },
  { name: 'remote database', env: { CI: 'true', BLOCK2_CI_DISPOSABLE: 'true', DATABASE_URL: 'postgresql://fixture:fixture@remote.example.invalid:5432/mds_crm_dev' }, error: 'Only the explicit loopback disposable database is permitted' },
]) {
  test('domain CI fails before server startup: ' + scenario.name, () => {
    const cwd = mkdtempSync(join(tmpdir(), 'domain-ci-refusal-'));
    try {
      if (scenario.localFile) writeFileSync(join(cwd, '.env.local'), 'SYNTHETIC_ONLY=true\n');
      const result = spawnSync(process.execPath, [script], { cwd, env: { PATH: process.env.PATH, HOME: '/tmp', ...scenario.env }, encoding: 'utf8', timeout: 10000 });
      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes(scenario.error));
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
}
