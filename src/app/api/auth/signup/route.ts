import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export async function POST(request: Request) {
  try {
    const { name, email, companyName, password } = await request.json()

    if (!name || !email || !companyName || !password) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Gera slug único para Organization
    const baseSlug = slugify(companyName)
    let slug = baseSlug || `org-${crypto.randomUUID().slice(0, 8)}`
    let i = 1

    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`
    }

    // Criar org + user em transação para não deixar org "órfã"
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: companyName,
          slug,
          plan: 'starter',
          planStatus: 'trial', // ✅ Campo correto: planStatus (não "status")
        },
      })

      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash: hashedPassword, // ✅ Campo correto: passwordHash
          role: 'admin',
          organizationId: organization.id,
        },
      })

      return { organization, user }
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
      },
    })
  } catch (error) {
    console.error('Erro ao criar conta:', error)
    return NextResponse.json({ error: 'Erro ao criar conta. Tente novamente.' }, { status: 500 })
  }
}
