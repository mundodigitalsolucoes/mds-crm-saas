// src/app/api/auth/signup/route.ts
// API de cadastro com registro de consentimento LGPD
// Aceita ?plan= e ?cid= vindos do fluxo Builderall → Asaas

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { parseBody, signupSchema } from '@/lib/validations'

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
    const cidParam  = searchParams.get('cid')  ?? null   // asaasCustomerId

    const body = await request.json()

    const parsed = parseBody(signupSchema, body)
    if (!parsed.success) return parsed.response

    const data = parsed.data

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })
    if (existingUser) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const forwarded  = request.headers.get('x-forwarded-for')
    const consentIp  = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown'

    const baseSlug = slugify(data.companyName)
    let slug = baseSlug || `org-${crypto.randomUUID().slice(0, 8)}`
    let i = 1
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`
    }

    // Resolve plano vindo da Builderall
    const plan       = PLAN_MAP[planParam.toLowerCase()] ?? 'trial'
    const planStatus = plan === 'trial' ? 'active' : 'active' // webhook confirma depois
    const trialEndsAt = plan === 'trial'
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 dias
      : null

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name:            data.companyName,
          slug,
          plan,
          planStatus,
          trialEndsAt,
          asaasCustomerId: cidParam,  // vincula cliente Asaas imediatamente
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
      { status: 500 }
    )
  }
}
