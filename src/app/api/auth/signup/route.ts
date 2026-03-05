// src/app/api/auth/signup/route.ts
//
// API de cadastro com provisionamento automático do Chatwoot.
// Mantém falha silenciosa: Chatwoot não provisionado NUNCA bloqueia o signup.
//
// FLUXO:
//   1. Valida dados e cria Organization + User (transação Prisma)
//   2. Dispara provisionamento Chatwoot em background (sem await bloqueante)
//   3. Retorna resposta ao usuário imediatamente
//
// CONTENÇÃO: se CHATWOOT_SUPER_ADMIN_EMAIL não estiver definido,
// o step 2 é ignorado e o admin provisiona manualmente via:
//   POST /api/admin/orgs/[orgId]/provision-chatwoot

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { parseBody, signupSchema } from '@/lib/validations'
import { provisionChatwootForOrg } from '@/lib/integrations/chatwoot-provision'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

const PLAN_MAP: Record<string, string> = {
  starter:      'starter',
  professional: 'professional',
  enterprise:   'enterprise',
  pro:          'professional',
  trial:        'trial',
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const planParam = searchParams.get('plan') ?? 'trial'
    const cidParam  = searchParams.get('cid')  ?? null

    const body   = await request.json()
    const parsed = parseBody(signupSchema, body)
    if (!parsed.success) return parsed.response

    const data = parsed.data

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const forwarded = request.headers.get('x-forwarded-for')
    const consentIp = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown'

    const baseSlug = slugify(data.companyName)
    let slug = baseSlug || `org-${crypto.randomUUID().slice(0, 8)}`
    let i = 1
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`
    }

    const plan        = PLAN_MAP[planParam.toLowerCase()] ?? 'trial'
    const trialEndsAt = plan === 'trial'
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      : null

    // ── 1. Criar Organization + User (transação atômica) ────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name:            data.companyName,
          slug,
          plan,
          planStatus:      'active',
          trialEndsAt,
          asaasCustomerId: cidParam,
        },
      })

      const user = await tx.user.create({
        data: {
          name:           data.name,
          email:          data.email,
          passwordHash:   hashedPassword,
          role:           'owner',
          organizationId: organization.id,
          consentAt:      new Date(),
          consentIp,
        },
      })

      return { organization, user }
    })

    // ── 2. Provisionar Chatwoot em background (falha silenciosa) ────────────
    // Não usamos await aqui para não atrasar a resposta ao usuário.
    // O provisionamento leva ~2-4s e não é crítico para o signup.
    provisionChatwootForOrg({
      organizationId: result.organization.id,
      orgName:        result.organization.name,
      orgSlug:        result.organization.slug,
      ownerUserId:    result.user.id,
      ownerName:      result.user.name,
      ownerEmail:     result.user.email,
      ownerPassword:  `Tmp@${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}!Z`,
    }).then((provResult) => {
      if (!provResult.success) {
        // Loga para monitoramento — admin pode reprovisionar manualmente
        console.warn(
          `[SIGNUP] Chatwoot não provisionado para org ${result.organization.slug}:`,
          provResult.error,
        )
      }
    }).catch((err) => {
      console.error('[SIGNUP] Erro inesperado no provisionamento Chatwoot:', err)
    })

    // ── 3. Responder imediatamente ───────────────────────────────────────────
    return NextResponse.json({
      message: 'Conta criada com sucesso!',
      user: {
        id:    result.user.id,
        name:  result.user.name,
        email: result.user.email,
      },
      organization: {
        id:   result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        plan: result.organization.plan,
      },
    })
  } catch (error) {
    console.error('Erro ao criar conta:', error)
    return NextResponse.json(
      { error: 'Erro ao criar conta. Tente novamente.' },
      { status: 500 },
    )
  }
}