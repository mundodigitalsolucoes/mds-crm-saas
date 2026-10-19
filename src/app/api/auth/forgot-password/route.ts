// src/app/api/auth/forgot-password/route.ts
// API de recuperação de senha — gera token + envia email via Resend

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import { parseBody, forgotPasswordSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ✅ Validação Zod centralizada (email já normalizado para lowercase)
    const parsed = parseBody(forgotPasswordSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Busca o usuário pelo email
    const user = await prisma.user.findFirst({
      where: {
        email: data.email,
        deletedAt: null,
        organization: { deletedAt: null },
      },
    });

    // Sempre retorna sucesso por segurança (não revela se o email existe)
    if (!user) {
      return NextResponse.json({
        message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
      });
    }

    // Gera token seguro; invalidacao e criacao ocorrem na mesma transacao.
    const token = randomBytes(32).toString('hex');
    await prisma.$transaction(async (tx) => {
      // PostgreSQL transaction-scoped lock serializes token rotation per email,
      // including concurrent requests handled by different application instances.
      await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtextextended(${data.email}, 0))`;
      await tx.passwordResetToken.updateMany({
        where: { email: data.email, used: false },
        data: { used: true },
      });
      await tx.passwordResetToken.create({
        data: {
          token,
          email: data.email,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    });

    // Monta o link de recuperação
    const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br';
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    // Envia o email
    await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetLink,
    });

    return NextResponse.json({
      message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
    });
  } catch (error) {
    console.error('[ForgotPassword] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
