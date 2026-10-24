// C6 infrastructure only. No production connections, migration deployment or providers.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SANITIZED_BASE = '8aa1db0b893b042967c3905a3582916b713cf9ab';
const protectedCommits = ['7face2f24b7e171aa897abf72bea8f429692b2cf', '98663c6d4a5c0b1a661f90966d6edc81a386a523'];
const unsafeCommits = ['59da966edfcc627c074b8c47a8bb50c314ad90a3', 'cb1884e413203baa123ca94dfb0a4c4635b6502a', 'c4cd327852eabeb96a628c9e69c815bf9bcbd674', '12e0e6735c4023ff4d2d947920703d30b3e252f0'];

export function disposableEnvironment(env, preparing = false) {
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw Error('Disposable database configuration required'); }
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '5432' || url.pathname !== '/mds_crm_dev') {
    throw Error('Only the explicit loopback disposable database is permitted');
  }
  if (env.BLOCK2_TEST_DATABASE_URL && env.BLOCK2_TEST_DATABASE_URL !== env.DATABASE_URL) throw Error('Test database must match disposable database');
  if (preparing && (env.CI !== 'true' || env.BLOCK2_CI_DISPOSABLE !== 'true')) throw Error('Schema preparation requires explicit disposable CI opt-in');
  return { ...env, BLOCK2_TEST_DATABASE_URL: env.DATABASE_URL };
}

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw Error('Git integrity prerequisite failed');
  return result.stdout.trim();
}
export function history() {
  const commits = new Set(git('rev-list', 'HEAD').split('\n'));
  for (const commit of [SANITIZED_BASE, ...protectedCommits]) if (!commits.has(commit)) throw Error('Sanitized baseline missing from candidate ancestry');
  if (unsafeCommits.some(commit => commits.has(commit))) throw Error('Unsafe ancestry detected');
  const paths = new Set(git('log', '--format=', '--name-only', 'HEAD').split('\n').filter(Boolean));
  for (const path of paths) {
    const name = path.split('/').at(-1);
    if ((name.startsWith('.env') && name !== '.env.example') || /\.(backup|pem|key)$/.test(name) || name === 'build.log') {
      throw Error('Forbidden sensitive/backup path in candidate ancestry');
    }
  }
  return { head: git('rev-parse', 'HEAD'), base: SANITIZED_BASE, commits: commits.size, historicalPaths: paths.size, protectedBaselinesReachable: true, unsafeAncestry: false, forbiddenPaths: 0 };
}
function execute(args, options = {}) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw Error('Validation command failed');
}
async function http() {
  const env = disposableEnvironment(process.env);
  env.NEXTAUTH_URL = 'http://127.0.0.1:3100';
  env.NEXTAUTH_SECRET = randomBytes(48).toString('hex');
  env.ADMIN_JWT_SECRET = randomBytes(48).toString('hex');
  env.NEXT_TELEMETRY_DISABLED = '1';
  const directory = resolve(env.BLOCK2_C6_REPORT_DIR || env.RUNNER_TEMP || '/tmp', 'block2-c6-http');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Do not accidentally test a stale build/server occupying the same port.
  const { createServer } = await import('node:net');
  const portCheck = createServer();
  await new Promise((accept, reject) => { portCheck.once('error', reject); portCheck.listen(3100, '127.0.0.1', accept); });
  await new Promise(accept => portCheck.close(accept));
  const log = openSync(resolve(directory, 'server-private.log'), 'w', 0o600);
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], { env, stdio: ['ignore', log, log] });
  let serverError;
  server.once('error', error => { serverError = error; });
  const results = [];
  try {
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline) {
      if (serverError || server.exitCode !== null) throw Error('Local test server failed to start');
      try { ready = (await fetch(env.NEXTAUTH_URL + '/api/auth/csrf', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* startup only */ }
      if (ready) break;
      await new Promise(accept => setTimeout(accept, 250));
    }
    if (!ready) throw Error('Local test server readiness timeout');
    for (const script of ['dashboard-c0-http', 'commercial-dashboard-http', 'branding-white-label-http', 'c5-cross-tenant-http', 'c5-direct-access-http', 'c5-task-os-regression-http']) {
      const result = spawnSync(process.execPath, [`tests/${script}.mjs`], { env, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
      // Only these fixture-only JSON outputs are eligible for CI artifacts. Server/stderr
      // logs remain private; no cookies, environment dumps or credentials are published.
      writeFileSync(resolve(directory, script + '.json'), result.stdout || '', { mode: 0o600 });
      results.push({ script, exit: result.status, signal: result.signal });
      console.log(JSON.stringify(results.at(-1)));
      if (result.status !== 0) throw Error('HTTP acceptance probe failed; no gate approval');
    }
  } finally {
    server.kill('SIGTERM');
    await new Promise(accept => {
      if (server.exitCode !== null || server.signalCode !== null) return accept();
      const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
      server.once('exit', () => { clearTimeout(timer); accept(); });
    });
    closeSync(log);
    writeFileSync(resolve(directory, 'summary.json'), JSON.stringify({ head: git('rev-parse', 'HEAD'), runtime: process.version, results }, null, 2) + '\n');
  }
}
async function main() {
  switch (process.argv[2]) {
    case 'history': console.log(JSON.stringify(history(), null, 2)); break;
    case 'prepare': execute(['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: disposableEnvironment(process.env, true) }); break;
    case 'lint': {
      const files = git('diff', '--name-only', '--diff-filter=ACMR', 'be26c81', 'HEAD', '--', 'src', 'tests', 'scripts').split('\n').filter(path => /\.(tsx?|m?js)$/.test(path));
      execute(['node_modules/eslint/bin/eslint.js', ...files]);
      // Entry HEAD already has eight warnings in C0-C5 files. Preserve their severity;
      // new C6 infrastructure must have zero warnings, and all changed files zero errors.
      execute(['node_modules/eslint/bin/eslint.js', '--max-warnings', '0', 'scripts/block2-c6-ci.mjs', 'tests/c6-ci-safety.test.mjs']);
      console.log(JSON.stringify({ lintedFiles: files.length, errors: 0, c6Warnings: 0, inheritedWarnings: 'reported above, not suppressed' })); break;
    }
    case 'node': {
      const env = disposableEnvironment(process.env);
      execute(['--import', 'tsx', '--test', '--test-reporter=tap', ...readdirSync('tests').filter(name => name.endsWith('.test.mjs')).sort().map(name => 'tests/' + name)], { env }); break;
    }
    case 'http': await http(); break;
    default: throw Error('Use history, lint, prepare, node or http');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('C6 validation failed; details remain local, no gate approval.'); process.exitCode = 1; });
}
