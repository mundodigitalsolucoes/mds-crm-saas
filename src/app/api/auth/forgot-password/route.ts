import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    // Busca o usuário pelo email
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    })

    // Sempre retorna sucesso por segurança (não revela se o email existe)
    if (!user) {
      return NextResponse.json({
        message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
      })
    }

    // Invalida tokens anteriores do mesmo email
    await prisma.passwordResetToken.updateMany({
      where: {
        email: email.toLowerCase(),
        used: false,
      },
      data: { used: true },
    })

    // Gera token seguro
    const token = randomBytes(32).toString('hex')

    // Cria o token no banco (expira em 1 hora)
    await prisma.passwordResetToken.create({
      data: {
        token,
        email: email.toLowerCase(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
      },
    })

    // Monta o link de recuperação
    const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br'
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`

    // Envia o email
    await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetLink,
    })

    return NextResponse.json({
      message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('[ForgotPassword] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}
