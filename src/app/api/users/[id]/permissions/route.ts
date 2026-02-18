// src/app/api/users/[id]/permissions/route.ts
// Atualiza permissões granulares de um usuário da organização
// Apenas owner e admin podem acessar

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAccess } from '@/lib/checkPermission';
import {
  parsePermissions,
  serializePermissions,
  getDefaultPermissions,
  ALL_MODULES,
} from '@/lib/permissions';
import type { UserRole, UserPermissions, PermissionAction } from '@/types/permissions';

const VALID_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete'];

// Hierarquia de roles (maior número = mais poder)
const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

/**
 * Valida se o objeto de permissões tem a estrutura correta.
 */
function validatePermissions(perms: unknown): perms is UserPermissions {
  if (typeof perms !== 'object' || perms === null) return false;

  for (const mod of ALL_MODULES) {
    const modPerms = (perms as Record<string, unknown>)[mod];
    if (typeof modPerms !== 'object' || modPerms === null) return false;

    for (const action of VALID_ACTIONS) {
      if (typeof (modPerms as Record<string, unknown>)[action] !== 'boolean') return false;
    }
  }

  return true;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verificar se é admin/owner
  const { allowed, session, errorResponse } = await checkAdminAccess();
  if (!allowed) return errorResponse!;

  const { id: targetUserId } = await params;
  const currentUserId = session!.user.id;
  const currentRole = session!.user.role;
  const organizationId = session!.user.organizationId;

  // 2. Não pode editar a si mesmo (evita lock-out)
  if (targetUserId === currentUserId) {
    return NextResponse.json(
      { error: 'Você não pode editar suas próprias permissões' },
      { status: 400 }
    );
  }

  // 3. Buscar usuário alvo
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, organizationId: true, name: true },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: 'Usuário não encontrado' },
      { status: 404 }
    );
  }

  // 4. Verificar mesma organização (multi-tenant)
  if (targetUser.organizationId !== organizationId) {
    return NextResponse.json(
      { error: 'Acesso negado: usuário de outra organização' },
      { status: 403 }
    );
  }

  // 5. Não pode editar owner (sempre full access)
  if (targetUser.role === 'owner') {
    return NextResponse.json(
      { error: 'Não é possível editar permissões do proprietário' },
      { status: 400 }
    );
  }

  // 6. Não pode editar role igual ou superior (admin não edita admin)
  const currentPower = ROLE_HIERARCHY[currentRole] || 0;
  const targetPower = ROLE_HIERARCHY[targetUser.role] || 0;

  if (currentRole !== 'owner' && targetPower >= currentPower) {
    return NextResponse.json(
      { error: 'Sem permissão para editar este usuário' },
      { status: 403 }
    );
  }

  // 7. Parsear body
  let body: { permissions?: unknown; resetToDefault?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Body inválido' },
      { status: 400 }
    );
  }

  let permissionsToSave: string;

  // 8. Reset para padrão do role
  if (body.resetToDefault) {
    const defaults = getDefaultPermissions(targetUser.role as UserRole);
    permissionsToSave = serializePermissions(defaults);
  } else {
    // 9. Validar e salvar permissões customizadas
    if (!body.permissions || !validatePermissions(body.permissions)) {
      return NextResponse.json(
        { error: 'Formato de permissões inválido' },
        { status: 400 }
      );
    }

    permissionsToSave = serializePermissions(body.permissions);
  }

  // 10. Salvar no banco
  try {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { permissions: permissionsToSave },
    });

    const savedPermissions = parsePermissions(
      permissionsToSave,
      targetUser.role as UserRole
    );

    return NextResponse.json({
      success: true,
      message: `Permissões de ${targetUser.name} atualizadas`,
      permissions: savedPermissions,
    });
  } catch (error) {
    console.error('[API PERMISSIONS] Erro ao salvar:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar permissões' },
      { status: 500 }
    );
  }
}
