// CI entrypoint: synthetic-only harness + fail-closed configuration refusals. No deploy mode.
import assert from 'node:assert/strict';
import {spawnSync, execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

if (process.env.BLOCK2_CUTOVER_SIMULATION !== 'synthetic-local-only') throw new Error('Explicit synthetic opt-in required');
let database;
try {database = new URL(process.env.BLOCK2_CUTOVER_DATABASE_URL || 'http://invalid');} catch {throw new Error('Disposable database required');}
assert.ok(['postgres:', 'postgresql:'].includes(database.protocol) && database.hostname === '127.0.0.1'
  && database.port === '5432' && database.pathname === '/mds_crm_dev' && database.username === 'mds_dev'
  && !database.search && !database.hash, 'Disposable database required');
assert.equal(process.argv.length, 2, 'No path or mode arguments accepted');
const directory = mkdtempSync('/tmp/block2-cutover-ci-');
const report = {kind: 'BLOCK2_CUTOVER_CI', head: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  simulationChecks: 0, refusalChecks: 0, passed: false, productionAccess: false,
  sourceSha256: Object.fromEntries(['scripts/block2-attachments-cutover-ci.mjs', 'tests/attachments-legacy-cutover-http.mjs', '.github/workflows/block2-postgres-concurrency.yml'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))};
const clean = {PATH: process.env.PATH};
const optIn = {...clean, BLOCK2_CUTOVER_SIMULATION: 'synthetic-local-only'};
const harness = 'tests/attachments-legacy-cutover-http.mjs';
function execute(env, args = []) {
  const child = spawnSync(process.execPath, [harness, ...args], {env, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 8 * 1024 * 1024});
  // Never publish raw subprocess stderr, environment or credentials.
  assert.ok(!child.error && child.signal === null, 'Harness execution failed or timed out');
  let result;
  try {result = JSON.parse(child.stdout);} catch {throw new Error('Harness did not return structured evidence');}
  return {exit: child.status, result};
}
try {
  const cases = [
    ['missing-opt-in', clean, [], 'explicit-opt-in'],
    ['external-host', {...optIn, BLOCK2_CUTOVER_DATABASE_URL: 'postgresql://mds_dev@192.0.2.1:5432/mds_crm_dev'}, [], 'disposable-database-only'],
    ['wrong-database', {...optIn, BLOCK2_CUTOVER_DATABASE_URL: 'postgresql://mds_dev@127.0.0.1:5432/production'}, [], 'disposable-database-only'],
    ['schema-injection', {...optIn, BLOCK2_CUTOVER_DATABASE_URL: 'postgresql://mds_dev@127.0.0.1:5432/mds_crm_dev?schema=public'}, [], 'disposable-database-only'],
    ['real-environment', {...optIn, NEXTAUTH_SECRET: 'synthetic-rejection-fixture'}, [], 'no-real-environment-inherited'],
    ['external-directory', optIn, ['--directory=/var/clients'], 'no-arguments-or-external-directory-input'],
  ];
  const refusals = [];
  for (const [name, env, args, expected] of cases) {
    const run = execute(env, args);
    const firstFailure = run.result.results.find(item => !item.passed)?.name;
    const passed = run.exit === 1 && run.result.passed === false && firstFailure === expected;
    refusals.push({name, exit: run.exit, rejectedAt: firstFailure, passed});
    writeFileSync(join(directory, 'refusals.json'), JSON.stringify(refusals, null, 2) + '\n', {mode: 0o600});
    assert.ok(passed, 'Unsafe configuration was not rejected at the expected boundary');
  }
  report.refusalChecks = refusals.length;
  const run = execute({...optIn, BLOCK2_CUTOVER_DATABASE_URL: database.toString()});
  writeFileSync(join(directory, 'simulation.json'), JSON.stringify(run.result, null, 2) + '\n', {mode: 0o600});
  const names = new Set(run.result.results.map(item => item.name));
  assert.equal(run.exit, 0, 'Simulation failed');
  assert.equal(run.result.passed, true);
  assert.equal(run.result.results.length, 174, 'Expected all 174 acceptance assertions');
  assert.equal(names.size, 174, 'Duplicate acceptance assertions');
  assert.ok(run.result.results.every(item => item.passed));
  for (const name of ['candidate-policy-byte-identical', 'candidate-working-tree-unchanged',
    'external-fetch-denied-before-send', 'external-socket-denied-before-send',
    'cleanup-mid-transaction-failure-restores-all-tables', 'cleanup-preservation-after-restart',
    'cleanup-recovery-never-restores-public-url', 'cleanup-direct-preserved-attachment-blocks-lead',
    'cleanup-direct-approved-pair-rollback', 'cleanup-direct-approved-pair-delete', 'cleanup-protected-config-credentials-oauth-receipts-unchanged']) {
    assert.ok(names.has(name), 'Required acceptance scenario missing');
  }
  report.simulationChecks = run.result.results.length;
  report.passed = true;
} catch {
  report.error = 'Acceptance failed; inspect structured fixture evidence';
  process.exitCode = 1;
} finally {
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
  console.log(JSON.stringify({...report, artifactDirectory: directory}));
}
