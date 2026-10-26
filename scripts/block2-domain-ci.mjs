// Fixture-only HTTP proof. Never connects to Coolify, production DNS, providers or a real database.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, mkdirSync, openSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { disposableEnvironment } from './block2-c6-ci.mjs';

if (process.env.CI !== 'true' || process.env.BLOCK2_CI_DISPOSABLE !== 'true') throw Error('Explicit disposable CI opt-in required');
if (readdirSync('.').some(name => name.startsWith('.env') && name !== '.env.example')) throw Error('Local environment files are forbidden in this HTTP simulation');
const disposable = disposableEnvironment(process.env);
const directory = resolve(process.env.RUNNER_TEMP || '/tmp', 'block2-custom-domain-http');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const port = createServer();
await new Promise((accept, reject) => { port.once('error', reject); port.listen(3100, '127.0.0.1', accept); });
await new Promise(accept => port.close(accept));
// Explicit allowlist: no provider credentials, inherited proxies or production environment.
const env = {
  PATH: process.env.PATH, HOME: '/tmp', DATABASE_URL: disposable.DATABASE_URL, BLOCK2_TEST_DATABASE_URL: disposable.DATABASE_URL,
  NEXTAUTH_URL: 'http://127.0.0.1:3100', NEXTAUTH_SECRET: randomBytes(48).toString('hex'),
  ADMIN_JWT_SECRET: randomBytes(48).toString('hex'), CRM_CUSTOM_DOMAINS_ENABLED: 'true',
  CRM_CUSTOM_DOMAIN_PROXY_SECRET: 'synthetic-domain-proxy-' + randomBytes(48).toString('hex'),
  BLOCK2_DOMAIN_TEST: 'synthetic-local-only', BLOCK2_DOMAIN_FIXTURE_ROOT: directory, NEXT_TELEMETRY_DISABLED: '1',
};
const log = openSync(resolve(directory, 'server-private.log'), 'w', 0o600);
let server;
let status = null;
async function start() {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], { env, stdio: ['ignore', log, log] });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw Error('Local test server exited');
    try { if ((await fetch(env.NEXTAUTH_URL + '/api/auth/csrf', { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* readiness only */ }
    await new Promise(accept => setTimeout(accept, 200));
  }
  throw Error('Local readiness timeout');
}
async function stop() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  server.kill('SIGTERM');
  await new Promise(accept => {
    if (server.exitCode !== null || server.signalCode !== null) return accept();
    const timeout = setTimeout(() => server.kill('SIGKILL'), 5000);
    server.once('exit', () => { clearTimeout(timeout); accept(); });
  });
}
function run(script, ...args) {
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', script, ...args], { env, encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw Error('Custom domain HTTP proof failed; private stderr not published');
  return result.stdout ? JSON.parse(result.stdout) : null;
}
const fixture = resolve(directory, 'restart-private.fixture');
let restartPrepared = false;
try {
  await start();
  const evidence = run('tests/custom-domain-http.mjs');
  if (evidence.passed !== true || !evidence.scenarios?.length || evidence.scenarios.some(item => item.passed !== true)) throw Error('Incomplete domain acceptance evidence');
  writeFileSync(resolve(directory, 'acceptance.json'), JSON.stringify(evidence, null, 2));
  // prepare writes only this synthetic fixture; cleanup is attempted even if prepare fails.
  restartPrepared = true;
  run('tests/custom-domain-restart-http.mjs', 'prepare', fixture);
  const before = run('tests/custom-domain-restart-http.mjs', 'check', fixture);
  await stop();
  await start();
  const after = run('tests/custom-domain-restart-http.mjs', 'check', fixture);
  writeFileSync(resolve(directory, 'restart.json'), JSON.stringify({ before, after, serverProcessRestarted: true }));
  status = 0;
  console.log(JSON.stringify({ passed: true, scenarios: evidence.scenarios.length, realRestartPassed: true, productionAccess: false, liveDnsOrCertificatesValidated: false }));
} finally {
  await stop();
  try {
    if (restartPrepared && existsSync(fixture)) run('tests/custom-domain-restart-http.mjs', 'cleanup', fixture);
  } catch (error) { status = 1; throw error; } finally {
    closeSync(log);
    writeFileSync(resolve(directory, 'summary.json'), JSON.stringify({ exit: status, productionAccess: false, networkBoundary: 'loopback HTTP; injected DNS/TLS success only' }, null, 2));
  }
}
