# MDS CRM SaaS — C03/C04 security correction report (candidate)

**Branch:** `feature/modular-plans-entitlements`  
**Baseline:** `6ee318f0656e1b79d8a4b6c7df6e9b393ce53f05`  
**Candidate:** `97b4fc272a76bc4c1085d46ba3ff2f869fb3d359` (before this report)

## Evidence and root cause

- **C04:** `src/app/api/auth/signup/route.ts` previously updated existing deleted users and their organization, reset password, cleared deletion flags, assigned `role: owner` and reprovisioned Chatwoot based only on public signup input.
- **C03:** `src/lib/admin-auth.ts`, `middleware.ts` and `src/app/api/admin/orgs/[orgId]/provision-chatwoot/route.ts` accepted JWTs with a fallback secret and/or signature-only validation. The schema's `SuperAdmin` model contains id, email, name and passwordHash, but no active/role/deletedAt fields.

## Candidate changes

1. Public signup now refuses **any** existing normalized email before entering the organization/user creation transaction. The reactivation path and its Chatwoot reprovisioning side effect were removed. A database unique constraint on `User.email` remains the final concurrency guard; a concurrent duplicate may return a generic 500 until handled separately.
2. Central admin signing requires a dedicated `ADMIN_JWT_SECRET` (at least 32 characters, excluding the known hardcoded fallback). No fallback to `NEXTAUTH_SECRET`.
3. Central admin verification checks HS256, `role: superadmin`, nonempty id, and a live `SuperAdmin` database row matching id and email. It returns current database name/email, not untrusted claims.
4. The Chatwoot admin provision route now uses the central verifier rather than its own signature-only JWT check. **Provider provisioning behavior was not modified.**
5. Middleware performs only preliminary JWT validation, while protected API routes must enforce the central database-backed check. The middleware itself does **not** query the database.

## Changed files

- `src/app/api/auth/signup/route.ts`
- `src/lib/admin-auth.ts`
- `src/app/api/admin/orgs/[orgId]/provision-chatwoot/route.ts`
- `middleware.ts`

## Validation status

- GitHub comparison confirms four code files changed from baseline; no Prisma schema or provider implementation changed.
- **Not executed:** automated tests, TypeScript compilation, Next.js build, Prisma checks, live login, real signup, staging integration or production requests.
- **Not homologated:** C03/C04 remain candidate fixes, not independently verified remediations.
- **Deployment blocked** until tests and a dedicated secret configuration check. The user has stated `ADMIN_JWT_SECRET` exists; its length and validity were not checked, and its value must never be shared.
- `package.json` includes a `prestart` Prisma migration command. Do **not** run application start against any real database during validation.

## Limitations and residual risks

- `SuperAdmin` has no active/deletedAt/role fields; only row presence and email match can be validated without a schema change.
- Existing tokens are not individually revocable while the admin row remains present; secret rotation invalidates all sessions.
- The public signup duplicate-email response can reveal account existence, as in the preexisting active-account behavior. Generic responses and concurrent duplicate error handling remain follow-up hardening items.
- Admin UI middleware checks a signed token but not live database authority; sensitive API routes must independently use the central verifier. Any future or overlooked admin API routes that rely solely on middleware require inventory.
- C01/C02 webhook authentication findings remain open and are outside this scope.

## Required tests before approval

- Signup: new account, existing active/inactive/deleted users, deleted organization, no role/password/tenant mutation, no reprovisioning, concurrent duplicate email, invitation/recovery compatibility.
- Admin: missing/weak/fallback secret, expired/forged token, missing admin row, email mismatch, stale claims, valid admin, admin API paths including Chatwoot provision GET/POST, legitimate login/logout.
- Run repository tests, TypeScript, build, Prisma validation and review GitHub CI status without using production credentials or data.

## Rollback

Revert the four candidate code commits individually in reverse order (do not roll back unrelated work); do not rotate existing secrets or alter database state as part of rollback. Assess any deployment separately.

## Governance

No merge, deploy, migration, provider lifecycle change, commercial enforcement or production data mutation is authorized. A separate independent review is required before claiming C03/C04 resolved.
