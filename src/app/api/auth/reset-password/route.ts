// src/app/api/auth/reset-password/route.ts
// API de redefinição de senha — valida token + atualiza hash

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { parseBody, resetPasswordSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(resetPasswordSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Busca o token no banco
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: data.token },
    });

    // Validações do token
    if (!resetToken) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado.' },
        { status: 400 }
      );
    }

    if (resetToken.used) {
      return NextResponse.json(
        { error: 'Este link já foi utilizado. Solicite um novo.' },
        { status: 400 }
      );
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: 'Este link expirou. Solicite um novo.' },
        { status: 400 }
      );
    }

    // Busca o usuário
    const user = await prisma.user.findFirst({
      where: { email: resetToken.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 }
      );
    }

    // Atualiza a senha e marca o token como usado
    const hashedPassword = await bcrypt.hash(data.password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({
      message: 'Senha redefinida com sucesso!',
    });
  } catch (error) {
    console.error('[ResetPassword] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
