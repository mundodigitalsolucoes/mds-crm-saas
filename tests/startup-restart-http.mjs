// Explicit opt-in, synthetic fixtures and loopback PostgreSQL only. No Docker/prod mode.
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

assert.equal(process.env.BLOCK2_STARTUP_DISPOSABLE, 'true');
const database = new URL(process.env.BLOCK2_STARTUP_DATABASE_URL || 'http://invalid');
assert.equal(database.protocol, 'postgresql:');
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.port, '5432');
assert.equal(database.pathname, '/mds_crm_dev');
assert.equal(database.search, '');
assert.equal(process.argv.length, 2);
const root = process.cwd(), results = [], db = new PrismaClient({ datasources: { db: { url: database.toString() } } });
let work, child, org;
const check = (name, ok, detail = {}) => { results.push({ name, passed: Boolean(ok), ...detail }); assert.ok(ok, name); };
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const current = child;
  process.kill(-current.pid, 'SIGTERM');
  await new Promise((yes, no) => { const timer = setTimeout(() => { process.kill(-current.pid, 'SIGKILL'); no(Error('Graceful shutdown timeout')); }, 10000); current.once('exit', () => { clearTimeout(timer); yes(); }); });
  check('graceful-shutdown', current.signalCode !== 'SIGKILL');
}
try {
  work = await mkdtemp(join(tmpdir(), 'block2-startup-synthetic-'));
  // Match runtime COPY set; never copy .env, source uploads, credentials or real mounts.
  for (const path of ['package.json', 'package-lock.json', 'next.config.js', '.next', 'prisma']) await cp(join(root, path), join(work, path), { recursive: true });
  await mkdir(join(work, 'public', 'images'), { recursive: true });
  await cp(join(root, 'public/images/logo-mds.svg'), join(work, 'public/images/logo-mds.svg'));
  await symlink(join(root, 'node_modules'), join(work, 'node_modules'), 'dir');
  const marker = join(work, 'migration-attempts.txt');
  // All spawned Node descendants inherit the guard. Block CLI attempts before execution.
  const guard = join(work, 'guard.cjs');
  await writeFile(guard, `const fs=require('node:fs'),cp=require('node:child_process');
const deny=(text)=>{if(/prisma.*(?:migrate|db[ -]+push)|prisma[\\/]build[\\/]index/i.test(text)){fs.appendFileSync(${JSON.stringify(marker)},'blocked migration CLI attempt\\n');throw Error('Migration CLI prohibited in startup test');}};
deny(process.argv.join(' '));for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']){const original=cp[k];cp[k]=function(...a){deny(String(a[0])+' '+(Array.isArray(a[1])?a[1].join(' '):''));return original.apply(this,a);};}
`);
  const portServer = createServer();
  await new Promise((yes, no) => { portServer.once('error', no); portServer.listen(0, '127.0.0.1', yes); });
  const port = portServer.address().port;
  await new Promise(yes => portServer.close(yes));
  const base = `http://127.0.0.1:${port}`;
  const env = { PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(port), DATABASE_URL: database.toString(), NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(48).toString('hex'), ADMIN_JWT_SECRET: randomBytes(48).toString('hex'), NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: `--require=${guard}` };
  const control = spawnSync(process.execPath, ['-e', "require('node:child_process').spawnSync('prisma',['migrate','deploy'])"], { cwd: work, env, encoding: 'utf8' });
  check('migration-detector-negative-control', control.status !== 0 && (await readFile(marker, 'utf8')).includes('blocked migration CLI attempt'));
  await writeFile(marker, '');
  const password = randomBytes(24).toString('hex');
  org = await db.organization.create({ data: { name: 'Synthetic startup', slug: 'startup-' + randomUUID(), plan: 'trial', trialEndsAt: new Date(Date.now() + 86400000) } });
  const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic owner', email: randomUUID() + '@example.invalid', passwordHash: await bcrypt.hash(password, 10), role: 'owner' } });
  const lead = await db.lead.create({ data: { organizationId: org.id, name: 'Synthetic startup lead' } });
  const schema = async () => JSON.stringify(await db.$queryRaw`SELECT table_schema,table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
  const before = await schema();
  const migrationTable = async () => db.$queryRaw`SELECT to_regclass('public._prisma_migrations')::text AS name`;
  const migrationsBefore = JSON.stringify(await migrationTable());
  check('disposable-baseline-has-no-migration-history-table', JSON.parse(migrationsBefore)[0].name === null);
  const cookies = new Map();
  async function request(path, options = {}) {
    const response = await fetch(base + path, { ...options, redirect: 'manual', headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...options.headers } });
    for (const value of response.headers.getSetCookie()) { const pair = value.split(';')[0], at = pair.indexOf('='); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    return response;
  }
  const docker = await readFile(join(root, 'Dockerfile'), 'utf8');
  const cmd = JSON.parse(docker.match(/^CMD (\[.*\])$/m)[1]);
  for (const mode of ['image-cmd', 'image-cmd-restart', 'npm-start-alternative']) {
    let log = '';
    const executable = mode === 'npm-start-alternative' ? 'npm' : process.execPath;
    const args = mode === 'npm-start-alternative' ? ['start', '--', '--hostname', '127.0.0.1'] : cmd.slice(1);
    child = spawn(executable, args, { cwd: work, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; });
    let ready = false;
    for (let n = 0; n < 150; n++) { if (child.exitCode !== null) throw Error('Startup exited'); try { ready = (await request('/api/auth/csrf')).ok; } catch { /* startup */ } if (ready) break; await new Promise(yes => setTimeout(yes, 200)); }
    check(mode + '-ready', ready);
    if (mode === 'image-cmd') {
      const csrf = await (await request('/api/auth/csrf')).json();
      await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: user.email, password, csrfToken: csrf.csrfToken, callbackUrl: base, json: 'true' }) });
    }
    const session = await (await request('/api/auth/session')).json();
    check(mode + '-session', session.user?.id === user.id);
    const response = await request('/api/leads');
    const body = await response.text();
    check(mode + '-prisma-http', response.status === 200 && body.includes(lead.id));
    const asset = await request('/images/logo-mds.svg');
    const bytes = Buffer.from(await asset.arrayBuffer());
    check(mode + '-asset', asset.status === 200 && createHash('sha256').update(bytes).digest('hex') === createHash('sha256').update(await readFile(join(work, 'public/images/logo-mds.svg'))).digest('hex'));
    check(mode + '-no-migration-log', !/prisma migrate|migrate deploy|Applying migration/i.test(log));
    await stop();
    check(mode + '-schema-unchanged', await schema() === before && JSON.stringify(await migrationTable()) === migrationsBefore);
  }
  let attempts = ''; try { attempts = await readFile(marker, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  check('zero-migration-cli-attempts', attempts === '');
  console.log(JSON.stringify({ kind: 'ISOLATED_STARTUP_RESTART_HTTP', results, passed: true, productionAccess: false, fullAlpineImageValidated: false }, null, 2));
} catch (error) { console.error(JSON.stringify({ kind: 'ISOLATED_STARTUP_RESTART_HTTP', results, passed: false, error: error.name })); process.exitCode = 1; }
finally { await stop(); if (org) await db.organization.delete({ where: { id: org.id } }); await db.$disconnect(); if (work) await rm(work, { recursive: true, force: true }); }
