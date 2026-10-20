// src/app/api/auth/signup/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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
  starter: 'starter',
  professional: 'professional',
  enterprise: 'enterprise',
  pro: 'professional',
  trial: 'trial',
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const planParam = searchParams.get('plan') ?? 'trial'
    const cidParam = searchParams.get('cid') ?? null

    const body = await request.json()
    const parsed = parseBody(signupSchema, body)
    if (!parsed.success) return parsed.response

    const data = parsed.data
    const normalizedEmail = data.email.trim().toLowerCase()

    const plan = PLAN_MAP[planParam.toLowerCase()] ?? 'trial'
    const trialEndsAt =
      plan === 'trial'
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        : null

    const forwarded = request.headers.get('x-forwarded-for')
    const consentIp = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown'

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    // Public signup must never reactivate or change an existing identity or tenant.
    // Authorized recovery/invitation flows are separate from public registration.
    if (existingUser) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    // Avoid hashing an unaccepted password and keep new-account behavior unchanged.
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const baseSlug = slugify(data.companyName)
    let slug = baseSlug || `org-${crypto.randomUUID().slice(0, 8)}`
    let i = 1

    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`
    }

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.companyName,
          slug,
          plan,
          planStatus: 'active',
          trialEndsAt,
          asaasCustomerId: cidParam,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
        },
      })

      const user = await tx.user.create({
        data: {
          name: data.name,
          email: normalizedEmail,
          passwordHash: hashedPassword,
          role: 'owner',
          organizationId: organization.id,
          consentAt: new Date(),
          consentIp,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })

      return { organization, user }
    })

    provisionChatwootForOrg({
      organizationId: result.organization.id,
      orgName: result.organization.name,
      orgSlug: result.organization.slug,
      ownerUserId: result.user.id,
      ownerName: result.user.name,
      ownerEmail: result.user.email,
      ownerPassword: `Tmp@${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}!Z`,
    })
      .then((provResult) => {
        if (!provResult.success) {
          console.warn(
            `[SIGNUP] Chatwoot não provisionado para org ${result.organization.slug}:`,
            provResult.error,
          )
        }
      })
      .catch((err) => {
        console.error('[SIGNUP] Erro inesperado no provisionamento Chatwoot:', err)
      })

    return NextResponse.json({
      message: 'Conta criada com sucesso!',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        plan: result.organization.plan,
      },
    })
  } catch (error) {
    // Concurrent registrations are ultimately serialized by the unique email constraint.
    // Never expose an internal error or attempt to reuse the existing identity.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Não foi possível concluir o cadastro com estes dados' }, { status: 409 })
    }
    console.error('Erro ao criar conta:', error)
    return NextResponse.json(
      { error: 'Erro ao criar conta. Tente novamente.' },
      { status: 500 },
    )
  }
}