// src/app/api/users/[id]/permissions/route.ts
// Atualiza permissões granulares e visibilidade operacional do Atendimento

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAccess } from '@/lib/checkPermission';
import {
  parsePermissions,
  serializePermissions,
  getDefaultPermissions,
} from '@/lib/permissions';
import { parseBody, userPermissionsUpdateSchema } from '@/lib/validations';
import type { UserRole, UserPermissions } from '@/types/permissions';

const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

function defaultVisibilityForRole(role: string): 'all' | 'assigned' | 'team' {
  if (role === 'owner' || role === 'admin') return 'all';
  if (role === 'manager') return 'team';
  return 'assigned';
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed, session, errorResponse } = await checkAdminAccess();
  if (!allowed) return errorResponse!;

  const { id: targetUserId } = await params;
  const currentUserId = session!.user.id;
  const currentRole = session!.user.role;
  const organizationId = session!.user.organizationId;

  if (targetUserId === currentUserId) {
    return NextResponse.json(
      { error: 'Você não pode editar suas próprias permissões' },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      role: true,
      organizationId: true,
      name: true,
      atendimentoVisibility: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: 'Usuário não encontrado' },
      { status: 404 }
    );
  }

  if (targetUser.organizationId !== organizationId) {
    return NextResponse.json(
      { error: 'Acesso negado: usuário de outra organização' },
      { status: 403 }
    );
  }

  if (targetUser.role === 'owner') {
    return NextResponse.json(
      { error: 'Não é possível editar permissões do proprietário' },
      { status: 400 }
    );
  }

  const currentPower = ROLE_HIERARCHY[currentRole] || 0;
  const targetPower = ROLE_HIERARCHY[targetUser.role] || 0;

  if (currentRole !== 'owner' && targetPower >= currentPower) {
    return NextResponse.json(
      { error: 'Sem permissão para editar este usuário' },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Body inválido' },
      { status: 400 }
    );
  }

  const parsed = parseBody(userPermissionsUpdateSchema, body);
  if (!parsed.success) return parsed.response;

  const data = parsed.data;

  let permissionsToSave: string | undefined;

  if (data.resetToDefault) {
    const defaults = getDefaultPermissions(targetUser.role as UserRole);
    permissionsToSave = serializePermissions(defaults);
  } else if (data.permissions) {
    permissionsToSave = serializePermissions(data.permissions as UserPermissions);
  }

  const atendimentoVisibility =
    data.resetToDefault
      ? defaultVisibilityForRole(targetUser.role)
      : data.atendimentoVisibility;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(permissionsToSave ? { permissions: permissionsToSave } : {}),
        ...(atendimentoVisibility ? { atendimentoVisibility } : {}),
      },
      select: {
        role: true,
        permissions: true,
        atendimentoVisibility: true,
      },
    });

    const savedPermissions = parsePermissions(
      updatedUser.permissions,
      updatedUser.role as UserRole
    );

    return NextResponse.json({
      success: true,
      message: `Permissões de ${targetUser.name} atualizadas`,
      permissions: savedPermissions,
      atendimentoVisibility: updatedUser.atendimentoVisibility,
    });
  } catch (error) {
    console.error('[API PERMISSIONS] Erro ao salvar:', error);

    return NextResponse.json(
      { error: 'Erro ao salvar permissões' },
      { status: 500 }
    );
  }
}