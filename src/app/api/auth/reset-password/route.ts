// src/app/api/auth/reset-password/route.ts
// API de redefinição de senha — valida token + atualiza hash

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { parseBody, resetPasswordSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    let domainOrganization: string | undefined;
    if (process.env.CRM_CUSTOM_DOMAINS_ENABLED === 'true') {
      const { resolveRequestDomain } = await import('@/lib/domains/request');
      const context = await resolveRequestDomain(request.headers);
      if (context.kind === 'denied' || context.kind === 'custom' && !context.active) return new NextResponse(null, { status: 421 });
      if (context.kind === 'custom') domainOrganization = context.organizationId;
    }
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
      where: {
        email: resetToken.email,
        ...(domainOrganization ? { organizationId: domainOrganization } : {}),
        deletedAt: null,
        organization: { deletedAt: null },
      },
    });

    if (!user && domainOrganization) return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 });
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 }
      );
    }

    // Atualiza a senha e marca o token como usado
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const consumed = await prisma.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, used: false, expiresAt: { gt: new Date() } },
        data: { used: true },
      });
      if (claim.count !== 1) return false;

      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          ...(domainOrganization ? { organizationId: domainOrganization } : {}),
          deletedAt: null,
          organization: { deletedAt: null },
        },
        data: { passwordHash: hashedPassword },
      });
      if (updated.count !== 1) throw new Error('RESET_USER_UNAVAILABLE');
      return true;
    });

    if (!consumed) {
      return NextResponse.json(
        { error: 'Este link já foi utilizado ou expirou. Solicite um novo.' },
        { status: 400 }
      );
    }

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
