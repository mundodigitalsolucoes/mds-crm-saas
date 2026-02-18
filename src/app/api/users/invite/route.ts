// src/app/api/users/invite/route.ts
// API para convidar/criar membro na mesma organização
// Acesso: owner e admin apenas

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const currentRole = session.user.role;

    // Apenas owner e admin podem convidar
    if (!['owner', 'admin'].includes(currentRole)) {
      return NextResponse.json(
        { error: 'Sem permissão para convidar membros' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    // Validações
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios (nome, email, senha, cargo)' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
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

    // Admin não pode criar outro admin (apenas owner pode)
    if (currentRole === 'admin' && role === 'admin') {
      return NextResponse.json(
        { error: 'Apenas o proprietário pode criar administradores' },
        { status: 403 }
      );
    }

    // Verificar hierarquia: não pode criar role >= ao próprio
    const currentPower = ROLE_HIERARCHY[currentRole] || 0;
    const targetPower = ROLE_HIERARCHY[role] || 0;
    if (targetPower >= currentPower && currentRole !== 'owner') {
      return NextResponse.json(
        { error: 'Não pode criar membro com cargo igual ou superior ao seu' },
        { status: 403 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está em uso no sistema' },
        { status: 400 }
      );
    }

    // Verificar limites da organização (se necessário no futuro)
    // const orgUsers = await prisma.user.count({ where: { organizationId: session.user.organizationId } });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: `Membro ${newUser.name} criado com sucesso!`,
      user: newUser,
    });
  } catch (error) {
    console.error('Erro ao convidar membro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao criar membro' },
      { status: 500 }
    );
  }
}
