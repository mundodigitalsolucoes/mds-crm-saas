// src/app/api/auth/me/route.ts
// Retorna permissões atualizadas do banco para sincronizar a session client-side

import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/checkPermission';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const authentication = await checkAuth();
  if (!authentication.authenticated || !authentication.session) return authentication.errorResponse!;
  const session = authentication.session;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { permissions: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    role: user.role,
    permissions: user.permissions,
  });
}
