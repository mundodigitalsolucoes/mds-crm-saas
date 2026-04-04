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

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const forwarded = request.headers.get('x-forwarded-for')
    const consentIp = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown'

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        deletedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            deletedAt: true,
            planStatus: true,
          },
        },
      },
    })

    const hasActiveAccount =
      existingUser &&
      !existingUser.deletedAt &&
      !existingUser.organization.deletedAt

    if (hasActiveAccount) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    let result: {
      organization: {
        id: string
        name: string
        slug: string
        plan: string
      }
      user: {
        id: string
        name: string
        email: string
      }
    }

    const canReactivate =
      existingUser &&
      (existingUser.deletedAt !== null || existingUser.organization.deletedAt !== null)

    if (canReactivate) {
      result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.update({
          where: { id: existingUser.organizationId },
          data: {
            name: data.companyName,
            deletedAt: null,
            plan,
            planStatus: 'active',
            trialEndsAt,
            ...(cidParam ? { asaasCustomerId: cidParam } : {}),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        })

        const user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: data.name,
            email: normalizedEmail,
            passwordHash: hashedPassword,
            role: 'owner',
            deletedAt: null,
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
              `[SIGNUP] Chatwoot não reprovisionado para org ${result.organization.slug}:`,
              provResult.error,
            )
          }
        })
        .catch((err) => {
          console.error('[SIGNUP] Erro inesperado no reprovisionamento Chatwoot:', err)
        })

      return NextResponse.json({
        message: 'Conta reativada com sucesso!',
        reactivated: true,
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
    }

    const baseSlug = slugify(data.companyName)
    let slug = baseSlug || `org-${crypto.randomUUID().slice(0, 8)}`
    let i = 1

    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`
    }

    result = await prisma.$transaction(async (tx) => {
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
    console.error('Erro ao criar conta:', error)
    return NextResponse.json(
      { error: 'Erro ao criar conta. Tente novamente.' },
      { status: 500 },
    )
  }
}