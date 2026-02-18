// src/app/api/users/invite/route.ts
// API para convidar/criar membro na mesma organização
// Acesso: owner e admin apenas (via checkAdminAccess)
// Dispara email de boas-vindas com credenciais via Resend

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAccess } from '@/lib/checkPermission';
import {
  getDefaultPermissions,
  serializePermissions,
} from '@/lib/permissions';
import { sendInviteEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@/types/permissions';

const ALLOWED_ROLES = ['admin', 'manager', 'user'] as const;
type InviteRole = (typeof ALLOWED_ROLES)[number];

const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar se é admin/owner via engine de permissões
    const { allowed, session, errorResponse } = await checkAdminAccess();
    if (!allowed) return errorResponse!;

    const currentUserId = session!.user.id;
    const currentRole = session!.user.role;
    const organizationId = session!.user.organizationId;

    // 2. Parsear body
    const body = await request.json();
    const { name, email, password, role } = body;

    // 3. Validações
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios (nome, email, senha, cargo)' },
        { status: 400 }
      );
    }

    if (typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome deve ter no mínimo 2 caracteres' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role as InviteRole)) {
      return NextResponse.json(
        { error: 'Cargo inválido. Use: admin, manager ou user' },
        { status: 400 }
      );
    }

    // 4. Admin não pode criar outro admin (apenas owner pode)
    if (currentRole === 'admin' && role === 'admin') {
      return NextResponse.json(
        { error: 'Apenas o proprietário pode criar administradores' },
        { status: 403 }
      );
    }

    // 5. Verificar hierarquia: não pode criar role >= ao próprio
    const currentPower = ROLE_HIERARCHY[currentRole] || 0;
    const targetPower = ROLE_HIERARCHY[role] || 0;
    if (targetPower >= currentPower && currentRole !== 'owner') {
      return NextResponse.json(
        { error: 'Não pode criar membro com cargo igual ou superior ao seu' },
        { status: 403 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 6. Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // 7. Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está em uso no sistema' },
        { status: 400 }
      );
    }

    // 8. Gerar permissões padrão do role
    const defaultPermissions = getDefaultPermissions(role as UserRole);
    const permissionsJson = serializePermissions(defaultPermissions);

    // 9. Hash da senha e criar usuário
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role,
        organizationId,
        permissions: permissionsJson,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        createdAt: true,
      },
    });

    // 10. Buscar dados para o email (nome de quem convidou + org)
    const [inviter, organization] = await Promise.all([
      prisma.user.findUnique({
        where: { id: currentUserId },
        select: { name: true },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
    ]);

    // 11. Disparar email de convite (não bloqueia resposta se falhar)
    sendInviteEmail({
      to: normalizedEmail,
      userName: newUser.name,
      password, // Senha em texto plano (antes do hash) para o email
      role,
      invitedBy: inviter?.name || 'Um administrador',
      organizationName: organization?.name,
    }).catch((err) => {
      console.error('[API INVITE] Falha ao enviar email de convite:', err);
    });

    return NextResponse.json({
      message: `Membro ${newUser.name} criado com sucesso! Email de boas-vindas enviado.`,
      user: newUser,
    });
  } catch (error) {
    console.error('[API INVITE] Erro ao convidar membro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao criar membro' },
      { status: 500 }
    );
  }
}
