// src/lib/checkPermission.ts
// Helper para verificar permissões nas API routes do MDS CRM
// Uso: chamar no início de cada handler para bloquear acesso não autorizado

import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  parsePermissions,
  hasPermission,
} from '@/lib/permissions';
import type {
  PermissionModule,
  PermissionAction,
  UserRole,
} from '@/types/permissions';

/**
 * Resultado da verificação de permissão.
 */
interface PermissionCheckResult {
  /** Se o usuário tem permissão */
  allowed: boolean;
  /** Session do usuário (se autenticado) */
  session: {
    user: {
      id: string;
      organizationId: string;
      role: string;
      name?: string | null;
      email?: string | null;
    };
  } | null;
  /** Response de erro pronta para retornar (se não permitido) */
  errorResponse: NextResponse | null;
}

/**
 * Verifica se o usuário da session tem permissão para acessar um módulo/ação.
 * 
 * Fluxo:
 * 1. Valida session (autenticação)
 * 2. Busca permissions do User no banco
 * 3. Parseia e verifica a permissão específica
 * 4. Owner sempre tem acesso total (bypass)
 * 
 * @param module - Módulo a verificar (ex: 'leads', 'tasks')
 * @param action - Ação a verificar (ex: 'view', 'create', 'edit', 'delete')
 * @returns PermissionCheckResult com allowed, session e errorResponse
 * 
 * @example
 * ```ts
 * // Em uma API route:
 * export async function GET(req: Request) {
 *   const { allowed, session, errorResponse } = await checkPermission('leads', 'view');
 *   if (!allowed) return errorResponse!;
 *   
 *   const organizationId = session!.user.organizationId;
 *   // ... buscar dados
 * }
 * ```
 */
export async function checkPermission(
  module: PermissionModule,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  // 1. Verificar autenticação
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session?.user?.organizationId) {
    return {
      allowed: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      ),
    };
  }

  const { id: userId, role, organizationId } = session.user;

  // 2. Owner tem acesso total (bypass de permissões)
  if (role === 'owner') {
    return {
      allowed: true,
      session,
      errorResponse: null,
    };
  }

  // 3. Buscar permissões do usuário no banco
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true, role: true, organizationId: true },
  });

  if (!user) {
    return {
      allowed: false,
      session,
      errorResponse: NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      ),
    };
  }

  // Segurança multi-tenant: garantir que o user pertence à org da session
  if (user.organizationId !== organizationId) {
    return {
      allowed: false,
      session,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado: organização inválida' },
        { status: 403 }
      ),
    };
  }

  // 4. Parsear permissões e verificar
  const permissions = parsePermissions(user.permissions, user.role as UserRole);
  const allowed = hasPermission(permissions, module, action);

  if (!allowed) {
    return {
      allowed: false,
      session,
      errorResponse: NextResponse.json(
        {
          error: 'Sem permissão',
          detail: `Você não tem permissão para ${action} em ${module}`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    session,
    errorResponse: null,
  };
}

/**
 * Versão simplificada que só verifica autenticação + retorna session.
 * Útil para rotas que não precisam de checagem granular (ex: notificações).
 * Mantém compatibilidade com o padrão existente das APIs.
 */
export async function checkAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session?.user?.organizationId) {
    return {
      authenticated: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      ),
    };
  }

  return {
    authenticated: true,
    session,
    errorResponse: null,
  };
}

/**
 * Verifica se o usuário é admin ou owner.
 * Útil para rotas administrativas (gerenciar membros, settings, etc).
 */
export async function checkAdminAccess() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session?.user?.organizationId) {
    return {
      allowed: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      ),
    };
  }

  const { role } = session.user;

  if (role !== 'owner' && role !== 'admin') {
    return {
      allowed: false,
      session,
      errorResponse: NextResponse.json(
        { error: 'Acesso restrito a administradores' },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    session,
    errorResponse: null,
  };
}
