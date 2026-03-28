// src/app/api/users/[id]/route.ts
// DELETE: remove membro da organização via SOFT DELETE
// Regras: não pode excluir owner, não pode excluir a si mesmo,
//         admin só exclui quem tem cargo menor que o seu

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';

const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

function buildDeletedEmail(userId: string, deletedAt: Date): string {
  return `deleted+${userId}.${deletedAt.getTime()}@deleted.local.invalid`;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed, session, errorResponse } = await checkPermission('users', 'delete');
  if (!allowed) return errorResponse!;

  const { id } = await params;
  const currentUserId = session!.user.id;
  const currentRole = session!.user.role as string;
  const organizationId = session!.user.organizationId;

  if (id === currentUserId) {
    return NextResponse.json(
      { error: 'Você não pode excluir sua própria conta por aqui' },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      name: true,
      role: true,
      deletedAt: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 });
  }

  if (target.deletedAt) {
    return NextResponse.json(
      { error: 'Este membro já foi removido' },
      { status: 409 }
    );
  }

  if (target.role === 'owner') {
    return NextResponse.json(
      { error: 'Não é possível excluir o proprietário da organização' },
      { status: 403 }
    );
  }

  if (currentRole !== 'owner') {
    const currentPower = ROLE_HIERARCHY[currentRole] ?? 0;
    const targetPower = ROLE_HIERARCHY[target.role] ?? 0;

    if (targetPower >= currentPower) {
      return NextResponse.json(
        { error: 'Você não tem permissão para excluir este membro' },
        { status: 403 }
      );
    }
  }

  const deletedAt = new Date();

  await prisma.user.update({
    where: { id },
    data: {
      deletedAt,
      email: buildDeletedEmail(target.id, deletedAt),
    },
  });

  return NextResponse.json({
    success: true,
    message: `Membro "${target.name}" removido com sucesso`,
  });
}