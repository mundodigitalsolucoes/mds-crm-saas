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
