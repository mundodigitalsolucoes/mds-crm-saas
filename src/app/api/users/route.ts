// src/app/api/users/route.ts
// Lista membros da organização do usuário logado
// Protegido por permissão: módulo 'users', ação 'view'

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';

export async function GET() {
  // Verificar permissão (users.view)
  const { allowed, session, errorResponse } = await checkPermission('users', 'view');
  if (!allowed) return errorResponse!;

  const organizationId = session!.user.organizationId;

  try {
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        createdAt: true,
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[API USERS] Erro ao listar membros:', error);
    return NextResponse.json(
      { error: 'Erro ao listar membros' },
      { status: 500 }
    );
  }
}
