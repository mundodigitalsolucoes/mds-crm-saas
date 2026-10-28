// src/app/api/admin/users/route.ts
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getDefaultPermissions, serializePermissions } from '@/lib/permissions';
import type { UserRole } from '@/types/permissions';
import { parseBody, adminUserCreateSchema } from '@/lib/validations';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';

// GET - Listar todos os usuários ativos do sistema
export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const orgId = searchParams.get('organizationId') || '';

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      organization: {
        is: {
          deletedAt: null,
        },
      },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (orgId) {
      where.organizationId = orgId;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[ADMIN USERS] Erro ao listar usuários:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - Cadastro explícito de usuário pelo Super Admin em organização existente.
export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const parsed = parseBody(adminUserCreateSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;
    const passwordHash = await bcrypt.hash(data.password, 12);
    const created = await prisma.$transaction(async tx => {
      const organization = await tx.organization.findUnique({
        where: { id: data.organizationId },
        select: { id: true, name: true, deletedAt: true, planStatus: true, maxUsers: true },
      });
      if (!organization || organization.deletedAt || organization.planStatus !== 'active') {
        return { error: 'Organização indisponível', status: 409 } as const;
      }
      const count = await tx.user.count({ where: { organizationId: organization.id, deletedAt: null } });
      if (organization.maxUsers !== -1 && count >= organization.maxUsers) {
        return { error: 'Limite de usuários do plano atingido', status: 409 } as const;
      }
      const existing = await tx.user.findUnique({ where: { email: data.email }, select: { id: true } });
      if (existing) return { error: 'E-mail já cadastrado', status: 409 } as const;
      const user = await tx.user.create({
        data: {
          organizationId: organization.id, name: data.name, email: data.email,
          passwordHash, role: data.role,
          permissions: serializePermissions(getDefaultPermissions(data.role as UserRole)),
        },
        select: { id: true, name: true, email: true, role: true, organizationId: true },
      });
      await tx.activity.create({ data: {
        entityType: 'user', entityId: user.id, action: 'created', userId: null,
        description: 'Usuário criado pelo Super Admin',
        metadata: JSON.stringify({ actorType: 'superadmin', actorId: admin.id, organizationId: organization.id }),
      } });
      return { user };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ('error' in created) return NextResponse.json({ error: created.error }, { status: created.status });
    return NextResponse.json(created.user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Cadastro concorrente; tente novamente' }, { status: 409 });
    }
    console.error('[ADMIN USERS] Erro ao criar usuário:', error);
    return NextResponse.json({ error: 'Não foi possível criar o usuário' }, { status: 500 });
  }
}
