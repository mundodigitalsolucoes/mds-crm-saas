// Static regression guardrails for C03/C04; run with: node --test tests/security-c03-c04.test.cjs
// These tests verify source-level invariants only; they do not replace runtime integration tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const source = (path) => readFileSync(join(__dirname, '..', path), 'utf8');

test('C04: public signup never reactivates or changes existing users', () => {
  const signup = source('src/app/api/auth/signup/route.ts');
  assert.match(signup, /if \(existingUser\)/);
  assert.doesNotMatch(signup, /canReactivate|reactivated:\s*true|tx\.user\.update|tx\.organization\.update/);
  assert.match(signup, /error\.code === 'P2002'/);
});

test('C03: dedicated secret, no fallback to tenant or known key', () => {
  const auth = source('src/lib/admin-auth.ts');
  const middleware = source('middleware.ts');
  for (const text of [auth, middleware]) {
    assert.match(text, /process\.env\.ADMIN_JWT_SECRET/);
    assert.doesNotMatch(text, /\|\|\s*process\.env\.NEXTAUTH_SECRET|\|\|\s*'super-admin-secret-key'/);
    assert.match(text, /algorithms:\s*\['HS256'\]/);
  }
});

test('C03: live DB identity check in shared verifier', () => {
  const auth = source('src/lib/admin-auth.ts');
  assert.match(auth, /prisma\.superAdmin\.findUnique/);
  assert.match(auth, /admin\.email !== payload\.email/);
  assert.match(auth, /payload\.role !== 'superadmin'/);
});

test('C03: Chatwoot manual provisioning uses shared verifier', () => {
  const route = source('src/app/api/admin/orgs/[orgId]/provision-chatwoot/route.ts');
  assert.match(route, /verifyAdminToken\(\)/);
  assert.doesNotMatch(route, /jwtVerify\(/);
});

test('C04: existing identities rejected before password hashing and side effects', () => {
  const signup = source('src/app/api/auth/signup/route.ts');
  const guard = signup.indexOf('if (existingUser)');
  assert.ok(guard > -1);
  assert.ok(guard < signup.indexOf('bcrypt.hash('));
  assert.ok(guard < signup.indexOf('prisma.$transaction('));
  assert.ok(guard < signup.indexOf('provisionChatwootForOrg({'));
});

test('C03: admin login and status use centralized JWT functions', () => {
  const route = source('src/app/api/admin/auth/route.ts');
  assert.match(route, /generateAdminToken\(/);
  assert.match(route, /verifyAdminToken\(/);
  assert.match(route, /setAdminCookie\(/);
  assert.match(route, /clearAdminCookie\(/);
});

test('C04: ordinary login rejects deleted users and organizations', () => {
  const auth = source('src/lib/auth.ts');
  assert.match(auth, /if \(!user \|\| user\.deletedAt \|\| user\.organization\.deletedAt\) return null/);
});

test('C04: password recovery remains separate from public signup', () => {
  const signup = source('src/app/api/auth/signup/route.ts');
  const forgot = source('src/app/api/auth/forgot-password/route.ts');
  const reset = source('src/app/api/auth/reset-password/route.ts');
  assert.doesNotMatch(signup, /passwordResetToken|sendPasswordResetEmail/);
  assert.match(forgot, /passwordResetToken\.create/);
  assert.match(reset, /passwordResetToken\.findUnique/);
});

test('C04: both password recovery endpoints reject deleted users and tenants', () => {
  for (const path of [
    'src/app/api/auth/forgot-password/route.ts',
    'src/app/api/auth/reset-password/route.ts',
  ]) {
    const route = source(path);
    assert.match(route, /deletedAt:\s*null/);
    assert.match(route, /organization:\s*\{\s*deletedAt:\s*null\s*\}/);
  }
});

test('C04: password reset claims the token once and rechecks active tenant inside transaction', () => {
  const reset = source('src/app/api/auth/reset-password/route.ts');
  assert.match(reset, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(reset, /tx\.passwordResetToken\.updateMany/);
  assert.match(reset, /used:\s*false,\s*expiresAt:\s*\{\s*gt:/);
  assert.match(reset, /claim\.count !== 1/);
  assert.match(reset, /tx\.user\.updateMany/);
  assert.match(reset, /updated\.count !== 1/);
});

test('C04: issuing a new reset token invalidates old links in the same transaction', () => {
  const forgot = source('src/app/api/auth/forgot-password/route.ts');
  assert.match(forgot, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(forgot, /tx\.passwordResetToken\.updateMany/);
  assert.match(forgot, /tx\.passwordResetToken\.create/);
  assert.doesNotMatch(forgot, /await prisma\.passwordResetToken\.updateMany/);
});

test('C04: concurrent reset issuance is serialized per email by PostgreSQL transaction lock', () => {
  const forgot = source('src/app/api/auth/forgot-password/route.ts');
  const lock = forgot.indexOf('pg_advisory_xact_lock(hashtextextended(');
  const invalidate = forgot.indexOf('tx.passwordResetToken.updateMany(');
  const issue = forgot.indexOf('tx.passwordResetToken.create(');
  assert.ok(lock > forgot.indexOf('prisma.$transaction(async (tx) =>'));
  assert.ok(lock < invalidate && invalidate < issue);
  assert.match(forgot, /tx\.\$queryRaw`SELECT pg_advisory_xact_lock\(hashtextextended\(\$\{data\.email\}, 0\)\)`/);
});
