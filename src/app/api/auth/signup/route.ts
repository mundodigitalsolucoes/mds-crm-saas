// src/app/api/auth/signup/route.ts
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

    // ── Verifica se email já existe ──────────────────────────────────────────
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email },
      include: { organization: { select: { deletedAt: true, planStatus: true } } },
    })

    if (existingUser) {
      // Conta inativa — redireciona para reativação
      if (existingUser.organization?.deletedAt) {
        return NextResponse.json(
          {
            error: 'conta_inativa',
            message: 'Você já possui uma conta inativa. Faça login para reativar seu plano.',
            redirect: '/login?reactivate=true',
          },
          { status: 409 }
        )
      }
      // Conta ativa — email em uso normal
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
    // Verifica slug incluindo orgs inativas
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`
    }

    const plan        = PLAN_MAP[planParam.toLowerCase()] ?? 'trial'
    const trialEndsAt = plan === 'trial'
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      : null

    // ── 1. Criar Organization + User ─────────────────────────────────────────
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

    // ── 2. Provisionar Chatwoot em background ────────────────────────────────
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
        console.warn(
          `[SIGNUP] Chatwoot não provisionado para org ${result.organization.slug}:`,
          provResult.error,
        )
      }
    }).catch((err) => {
      console.error('[SIGNUP] Erro inesperado no provisionamento Chatwoot:', err)
    })

    // ── 3. Responder imediatamente ────────────────────────────────────────────
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