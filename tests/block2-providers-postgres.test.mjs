import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server.js'
import * as permissions from '../src/lib/permissions.ts'
import { disposableDatabaseUrl, loadHandler } from './helpers/load-disposable-handler.mjs'
let prisma
const orgs = []
before(() => { prisma = new PrismaClient({ datasources: { db: { url: disposableDatabaseUrl() } } }) })
after(async () => { if (prisma) { for (const id of orgs) await prisma.organization.delete({ where: { id } }); await prisma.$disconnect() } })
async function fixture(role = 'owner') {
  const suffix = randomUUID()
  const org = await prisma.organization.create({ data: { name: 'Provider fixture', slug: `provider-${suffix}`, trialEndsAt: new Date(Date.now() + 86400000) } }); orgs.push(org.id)
  const user = await prisma.user.create({ data: { name: 'Provider fixture', organizationId: org.id, email: `${suffix}@example.invalid`, role, passwordHash: 'fixture-not-login', permissions: role === 'user' ? JSON.stringify({ integrations: { view: false, edit: false } }) : '{}' } })
  const instance = await prisma.whatsappInstance.create({ data: { organizationId: org.id, instanceName: `instance-${suffix}`, isActive: true } })
  return { org, user, instance }
}
function guard(f) {
  return loadHandler('src/lib/checkPermission.ts', { 'next/server': { NextResponse }, 'next-auth': { getServerSession: async () => ({ user: { id: f.user.id, organizationId: f.org.id, role: f.user.role } }) }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions })
}
test('G3 Evolution: foreign lifecycle IDs cannot call providers or mutate another tenant', async () => {
  const a = await fixture(), b = await fixture(); let calls = 0
  const noProvider = async () => { calls++; throw new Error('Unexpected provider access') }
  const lifecycle = loadHandler('src/lib/atendimento/orchestration/channel-lifecycle.ts', {
    '@/lib/prisma': { prisma }, '@/lib/integrations/crypto': { decryptToken: () => 'fixture-token', encryptToken: () => 'fixture-encrypted' }, '@/lib/integrations/chatwoot-evo': { setupChatwootEvolution: noProvider },
    '@/lib/integrations/evolutionClient': { createInstance: noProvider, disconnectInstance: noProvider, fetchInstanceInfo: noProvider, getInstanceState: noProvider, waitUntilInstanceInactive: noProvider },
  })
  const before = await prisma.whatsappInstance.findUnique({ where: { id: b.instance.id } })
  for (const method of ['reconnectWhatsappChannel', 'finalizeWhatsappChannel', 'disconnectWhatsappChannel', 'deleteWhatsappChannel']) {
    await assert.rejects(lifecycle[method]({ organizationId: a.org.id, userId: a.user.id, instanceId: b.instance.id, evoUrl: 'https://evolution.example.invalid', evoKey: 'fixture-token' }), error => error.status === 404)
  }
  assert.equal(calls, 0)
  assert.deepEqual(await prisma.whatsappInstance.findUnique({ where: { id: b.instance.id } }), before)
})
test('G3 Evolution: QR uses tenant ownership, denies Cloud instances and restricted role', async () => {
  const foreign = await fixture()
  for (const role of ['owner', 'admin', 'user']) {
    const f = await fixture(role); let calls = 0
    const route = loadHandler('src/app/api/integrations/evolution/qrcode/route.ts', {
      'next/server': { NextResponse }, '@/lib/checkPermission': guard(f), '@/lib/prisma': { prisma },
      '@/lib/integrations/evolutionClient': { getInstanceState: async () => { calls++; return 'open' }, getQRCode: async () => { calls++; return { base64: 'fixture-qr' } } },
    })
    const qr = name => new NextRequest(`http://localhost/api/integrations/evolution/qrcode?instance=${name}&mode=status`)
    assert.equal((await route.GET(qr(foreign.instance.instanceName))).status, role === 'user' ? 403 : 404)
    assert.equal(calls, 0)
    assert.equal((await route.GET(qr(f.instance.instanceName))).status, role === 'user' ? 403 : 200)
    await prisma.whatsappInstance.update({ where: { id: f.instance.id }, data: { metadata: JSON.stringify({ provider: 'whatsapp_cloud' }) } })
    const before = calls; assert.equal((await route.GET(qr(f.instance.instanceName))).status, role === 'user' ? 403 : 404); assert.equal(calls, before)
  }
})
test('G3 Google: actual email adapter scopes credentials to session tenant for three roles', async () => {
  for (const role of ['owner', 'admin', 'user']) {
    const f = await fixture(role); let calls = 0
    const adapter = loadHandler('src/lib/atendimento/providers/email.ts', { '@/lib/chatwoot': {
      getChatwootCredentials: async id => { assert.equal(id, f.org.id); return { organizationId: id, accountId: 401 } },
      chatwootApi: async (credentials, path) => { assert.equal(credentials.organizationId, f.org.id); assert.equal(path, '/google/authorization'); calls++; return { success: true, url: 'https://accounts.google.com/o/oauth2/auth?client_id=fixture' } },
    } })
    const limits = loadHandler('src/lib/checkLimits.ts', { 'next/server': { NextResponse }, '@/lib/prisma': { prisma } })
    const route = loadHandler('src/app/api/atendimento/canais/email/google/authorize/route.ts', {
      'next/server': { NextResponse }, '@/lib/checkPermission': guard(f), '@/lib/checkLimits': limits,
      '@/lib/authorization/channel-observation': { observeChannelEntitlement: async () => undefined }, '@/lib/atendimento/providers/email': adapter,
    })
    assert.equal((await route.POST()).status, role === 'user' ? 403 : 200)
    assert.equal(calls, role === 'user' ? 0 : 1)
  }
})
test('G3 Google: hostile authorization URL from provider is never returned', async () => {
  const adapter = loadHandler('src/lib/atendimento/providers/email.ts', { '@/lib/chatwoot': { getChatwootCredentials: async () => ({ accountId: 401 }), chatwootApi: async () => ({ success: true, url: 'https://attacker.example.invalid/?client_id=fixture' }) } })
  await assert.rejects(adapter.getGoogleEmailAuthorizationUrl('fixture-tenant'))
})
