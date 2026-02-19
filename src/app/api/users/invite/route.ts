// src/app/api/users/invite/route.ts
// API para convidar/criar membro na mesma organização
// Acesso: owner e admin apenas (via checkAdminAccess)
// Dispara email de boas-vindas com credenciais via Resend

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminAccess } from '@/lib/checkPermission';
import { checkOrganizationLimit, checkPlanActive } from '@/lib/checkLimits';
import {
  getDefaultPermissions,
  serializePermissions,
} from '@/lib/permissions';
import { sendInviteEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import { parseBody, userInviteSchema } from '@/lib/validations';
import type { UserRole } from '@/types/permissions';

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

    // 2. ✅ Verificar se plano está ativo
    const planCheck = await checkPlanActive(organizationId);
    if (!planCheck.active) return planCheck.errorResponse!;

    // 3. ✅ Verificar limite de usuários do plano
    const limitCheck = await checkOrganizationLimit(organizationId, 'users');
    if (!limitCheck.allowed) return limitCheck.errorResponse!;

    // 4. ✅ Validação Zod centralizada
    const body = await request.json();
    const parsed = parseBody(userInviteSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // 5. Admin não pode criar outro admin (apenas owner pode)
    if (currentRole === 'admin' && data.role === 'admin') {
      return NextResponse.json(
        { error: 'Apenas o proprietário pode criar administradores' },
        { status: 403 }
      );
    }

    // 6. Verificar hierarquia: não pode criar role >= ao próprio
    const currentPower = ROLE_HIERARCHY[currentRole] || 0;
    const targetPower = ROLE_HIERARCHY[data.role] || 0;
    if (targetPower >= currentPower && currentRole !== 'owner') {
      return NextResponse.json(
        { error: 'Não pode criar membro com cargo igual ou superior ao seu' },
        { status: 403 }
      );
    }

    // 7. Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está em uso no sistema' },
        { status: 400 }
      );
    }

    // 8. Gerar permissões padrão do role
    const defaultPermissions = getDefaultPermissions(data.role as UserRole);
    const permissionsJson = serializePermissions(defaultPermissions);

    // 9. Hash da senha e criar usuário
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashedPassword,
        role: data.role,
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
      to: data.email,
      userName: newUser.name,
      password: data.password, // Senha em texto plano (antes do hash) para o email
      role: data.role,
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
