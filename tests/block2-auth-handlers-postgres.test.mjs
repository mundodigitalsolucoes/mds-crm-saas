import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { PrismaClient, Prisma } from '@prisma/client'
import { NextResponse } from 'next/server.js'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import * as validation from '../src/lib/validations/index.ts'
import * as permissions from '../src/lib/permissions.ts'
import { disposableDatabaseUrl, loadHandler } from './helpers/load-disposable-handler.mjs'
let prisma, signup, forgot, reset, adminAuth, adminHelper, cookieToken
const env = { ADMIN_JWT_SECRET: randomBytes(32).toString('hex'), NEXTAUTH_URL: 'http://localhost:3100' }
const orgIds = [], adminIds = [], emails = [], messages = []
let providerCalls = 0
const request = data => new Request('http://localhost:3100/api/local-test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
const quiet = { info() {}, warn() {}, error() {} }
before(() => {
  prisma = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } })
  const common = { 'next/server': { NextResponse }, '@/lib/prisma': { prisma }, bcryptjs: bcrypt, '@/lib/validations': validation }
  signup = loadHandler('src/app/api/auth/signup/route.ts', { ...common, '@prisma/client': { Prisma }, '@/lib/integrations/chatwoot-provision': { provisionChatwootForOrg: async () => { providerCalls++; return { success: true } } } }, { console: quiet }).POST
  forgot = loadHandler('src/app/api/auth/forgot-password/route.ts', { ...common, '@/lib/email': { sendPasswordResetEmail: async data => { messages.push(data) } } }, { process: { env }, console: quiet }).POST
  reset = loadHandler('src/app/api/auth/reset-password/route.ts', common, { console: quiet }).POST
  adminHelper = loadHandler('src/lib/admin-auth.ts', { '@/lib/prisma': { prisma }, 'next/headers': { cookies: async () => ({ get: () => cookieToken ? { value: cookieToken } : undefined }) } }, { process: { env } })
  adminAuth = loadHandler('src/app/api/admin/auth/route.ts', { ...common, '@/lib/admin-auth': adminHelper }, { console: quiet })
})
after(async () => {
  if (!prisma) return
  for (const email of emails) await prisma.passwordResetToken.deleteMany({ where: { email } })
  for (const id of adminIds) await prisma.superAdmin.deleteMany({ where: { id } })
  for (const id of orgIds) await prisma.organization.delete({ where: { id } })
  await prisma.$disconnect()
})
async function fixture(role = 'owner') {
  const suffix = randomUUID(), password = randomBytes(24).toString('hex')
  const org = await prisma.organization.create({ data: { name: `Auth ${suffix}`, slug: `auth-${suffix}`, trialEndsAt: new Date(Date.now() + 86400000) } }); orgIds.push(org.id)
  const user = await prisma.user.create({ data: { organizationId: org.id, name: 'Fixture', email: `${suffix}@example.invalid`, passwordHash: await bcrypt.hash(password, 10), role } }); emails.push(user.email)
  return { org, user, password }
}
async function superAdmin() {
  const password = randomBytes(24).toString('hex')
  const admin = await prisma.superAdmin.create({ data: { name: 'Local admin', email: `${randomUUID()}@example.invalid`, passwordHash: await bcrypt.hash(password, 10) } }); adminIds.push(admin.id)
  return { admin, password }
}
test('C03-01/02/07: real admin hash login, HttpOnly cookie, invalid password and logout', async () => {
  const { admin, password } = await superAdmin()
  const good = await adminAuth.POST(request({ email: admin.email, password }))
  assert.equal(good.status, 200); const cookie = good.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/)
  cookieToken = cookie.split(';')[0].slice('admin-token='.length)
  assert.equal((await adminAuth.GET()).status, 200)
  const invalid = await adminAuth.POST(request({ email: admin.email, password: 'wrong-password' }))
  assert.equal(invalid.status, 401); assert.equal(invalid.headers.has('set-cookie'), false)
  assert.match((await adminAuth.DELETE()).headers.get('set-cookie'), /Max-Age=0/)
  cookieToken = undefined; assert.equal((await adminAuth.GET()).status, 401)
})
test('C03-03: missing or weak admin secret never emits a JWT', async () => {
  const { admin, password } = await superAdmin(); const original = env.ADMIN_JWT_SECRET
  try {
    for (const weak of [undefined, 'short', 'super-admin-secret-key']) {
      env.ADMIN_JWT_SECRET = weak
      const response = await adminAuth.POST(request({ email: admin.email, password }))
      assert.equal(response.status, 500); assert.equal(response.headers.has('set-cookie'), false)
    }
  } finally { env.ADMIN_JWT_SECRET = original }
})
test('C03-04/05/06: tampered/expired/wrong-role/algorithm/deleted/changed-email admin rejected', async () => {
  const { admin } = await superAdmin()
  const payload = { id: admin.id, email: admin.email, role: 'superadmin' }, key = new TextEncoder().encode(env.ADMIN_JWT_SECRET)
  const tokens = ['tampered.token', await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1s').setIssuedAt().setExpirationTime(1).sign(key), await new SignJWT({ ...payload, role: 'owner' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(key), await new SignJWT(payload).setProtectedHeader({ alg: 'HS384' }).setExpirationTime('1h').sign(key)]
  for (const token of tokens) { cookieToken = token; assert.equal((await adminAuth.GET()).status, 401) }
  cookieToken = await adminHelper.generateAdminToken({ ...admin, role: 'superadmin' })
  await prisma.superAdmin.update({ where: { id: admin.id }, data: { email: `${randomUUID()}@example.invalid` } })
  assert.equal((await adminAuth.GET()).status, 401)
  await prisma.superAdmin.update({ where: { id: admin.id }, data: { email: admin.email } })
  await prisma.superAdmin.delete({ where: { id: admin.id } }); assert.equal((await adminAuth.GET()).status, 401)
  cookieToken = undefined
})
test('C03-08: manual provider provisioning rejects anonymous before DB/provider effects', async () => {
  cookieToken = undefined
  const route = loadHandler('src/app/api/admin/orgs/[orgId]/provision-chatwoot/route.ts', {
    'next/server': { NextResponse }, '@/lib/admin-auth': adminHelper,
    '@/lib/prisma': { prisma: { organization: { findUnique: () => { throw new Error('DB must not be consulted') } } } },
    '@/lib/integrations/chatwoot-provision': { provisionChatwootForOrg: () => { throw new Error('Provider must not be called') } },
  })
  assert.equal((await route.POST(request({}), { params: Promise.resolve({ orgId: randomUUID() }) })).status, 401)
  assert.equal((await route.GET(new Request('http://localhost:3100/api/test'), { params: Promise.resolve({ orgId: randomUUID() }) })).status, 401)
})
test('C04-01/05: concurrent signup creates one identity and no orphan tenant', async () => {
  const suffix = randomUUID(), email = `${suffix}@example.invalid`, companyName = `Signup ${suffix}`
  const body = { email, companyName, name: 'Local owner', password: randomBytes(24).toString('hex'), consent: true }
  const beforeCalls = providerCalls
  const results = await Promise.all([signup(request(body)), signup(request(body))])
  const users = await prisma.user.findMany({ where: { email } }); const orgs = await prisma.organization.findMany({ where: { name: companyName } })
  orgIds.push(...orgs.map(org => org.id)); emails.push(email)
  assert.equal(users.length, 1); assert.equal(orgs.length, 1)
  assert.equal(results.filter(r => r.status === 200).length, 1)
  assert.ok(results.every(r => [200, 400, 409].includes(r.status)))
  assert.equal(providerCalls - beforeCalls, 1, 'one mocked provisioning call; no real provider')
})
test('C04-02/03/04: signup never changes active/deleted identity or deleted organization', async () => {
  for (const state of ['active', 'user-deleted', 'org-deleted']) {
    const f = await fixture('user')
    if (state === 'user-deleted') await prisma.user.update({ where: { id: f.user.id }, data: { deletedAt: new Date() } })
    if (state === 'org-deleted') await prisma.organization.update({ where: { id: f.org.id }, data: { deletedAt: new Date() } })
    const before = await prisma.user.findUnique({ where: { id: f.user.id } }); const beforeCalls = providerCalls
    assert.equal((await signup(request({ email: f.user.email, companyName: 'Do not reactivate', name: 'Intruder', password: 'another-password', consent: true }))).status, 400)
    assert.deepEqual(await prisma.user.findUnique({ where: { id: f.user.id } }), before)
    assert.equal(providerCalls, beforeCalls)
  }
})
test('C04-06: actual recovery issuance serializes by email and reset token is single-use', async () => {
  const f = await fixture(); const responses = await Promise.all([forgot(request({ email: f.user.email })), forgot(request({ email: f.user.email }))])
  assert.ok(responses.every(r => r.status === 200))
  const active = await prisma.passwordResetToken.findMany({ where: { email: f.user.email, used: false } }); assert.equal(active.length, 1)
  assert.equal(messages.filter(m => m.to === f.user.email).length, 2)
  const attempts = await Promise.all([reset(request({ token: active[0].token, password: 'first-strong-password' })), reset(request({ token: active[0].token, password: 'second-strong-password' }))])
  assert.deepEqual(attempts.map(r => r.status).sort(), [200, 400])
  assert.equal((await reset(request({ token: active[0].token, password: 'third-strong-password' }))).status, 400)
})
test('C04-07: deleted users/tenants get generic recovery response and cannot reset old token', async () => {
  for (const field of ['user', 'organization']) {
    const f = await fixture(); const token = randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({ data: { token, email: f.user.email, expiresAt: new Date(Date.now() + 60000) } })
    await prisma[field].update({ where: { id: field === 'user' ? f.user.id : f.org.id }, data: { deletedAt: new Date() } })
    const beforeMessages = messages.length
    const recovery = await forgot(request({ email: f.user.email })); assert.equal(recovery.status, 200)
    assert.equal(messages.length, beforeMessages)
    assert.equal((await reset(request({ token, password: 'cannot-change-password' }))).status, 404)
    assert.equal((await prisma.user.findUnique({ where: { id: f.user.id } })).passwordHash, f.user.passwordHash)
  }
})
test('G2: three roles use DB membership; forged session role cannot elevate and tenant mismatch denied', async () => {
  for (const role of ['owner', 'admin', 'user']) {
    const f = await fixture(role)
    const session = { user: { id: f.user.id, organizationId: f.org.id, role: 'owner' } }
    const guard = loadHandler('src/lib/checkPermission.ts', { 'next/server': { NextResponse }, 'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions })
    assert.equal((await guard.checkAdminAccess()).allowed, role !== 'user')
    session.user.organizationId = randomUUID()
    assert.equal((await guard.checkPermission('leads', 'view')).errorResponse.status, 403)
  }
})
test('G2/C04-06: legitimate invitation works; stale owner claim cannot let an admin create another admin', async () => {
  const limits = loadHandler('src/lib/checkLimits.ts', { 'next/server': { NextResponse }, '@/lib/prisma': { prisma } })
  for (const role of ['owner', 'admin', 'user']) {
    const f = await fixture(role)
    const session = { user: { id: f.user.id, organizationId: f.org.id, role: 'owner' } }
    const guard = loadHandler('src/lib/checkPermission.ts', { 'next/server': { NextResponse }, 'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions })
    const invite = loadHandler('src/app/api/users/invite/route.ts', {
      'next/server': { NextResponse }, '@/lib/prisma': { prisma }, '@/lib/checkPermission': guard,
      '@/lib/checkLimits': limits, '@/lib/permissions': permissions, '@/lib/validations': validation,
      '@/lib/email': { sendInviteEmail: async () => undefined },
      '@/lib/chatwoot': { getChatwootCredentials: async () => null },
    }, { console: quiet }).POST
    const email = `${randomUUID()}@example.invalid`; emails.push(email)
    const response = await invite(request({ email, name: 'Invited fixture', password: 'invited-strong-password', role: 'admin' }))
    assert.equal(response.status, role === 'owner' ? 200 : 403, `actual DB role ${role} must override stale session owner claim`)
    assert.equal(await prisma.user.count({ where: { email } }), role === 'owner' ? 1 : 0)
  }
})
