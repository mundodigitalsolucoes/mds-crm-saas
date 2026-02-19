// src/app/api/admin/users/[id]/route.ts
// API Admin — Atualização e Exclusão de Usuário
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { parseBody, adminUserUpdateSchema } from '@/lib/validations';

// PUT - Atualizar usuário (mudar role)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();

    // ✅ Validação Zod centralizada (role validado pelo enum)
    const parsed = parseBody(adminUserUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const user = await prisma.user.update({
      where: { id },
      data: { role: data.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[ADMIN USERS] Erro ao atualizar usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE - Excluir usuário
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('[ADMIN USERS] Erro ao excluir usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
