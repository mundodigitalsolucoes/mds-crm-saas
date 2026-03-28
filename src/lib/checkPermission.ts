// src/lib/checkPermission.ts
// Helper para verificar permissões nas API routes do MDS CRM
// Agora também bloqueia usuário deletado e organização inativa

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

interface SessionUserShape {
  user: {
    id: string;
    organizationId: string;
    role: string;
    name?: string | null;
    email?: string | null;
  };
}

interface PermissionCheckResult {
  allowed: boolean;
  session: SessionUserShape | null;
  errorResponse: NextResponse | null;
}

type ActiveUserRecord = {
  id: string;
  role: string;
  permissions: string;
  organizationId: string;
  deletedAt: Date | null;
  organization: {
    deletedAt: Date | null;
  };
};

async function loadActiveUser(userId: string): Promise<ActiveUserRecord | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      permissions: true,
      organizationId: true,
      deletedAt: true,
      organization: {
        select: {
          deletedAt: true,
        },
      },
    },
  });
}

function buildInactiveResponse(reason: 'not_found' | 'deleted' | 'org_deleted' | 'org_mismatch') {
  switch (reason) {
    case 'not_found':
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    case 'deleted':
      return NextResponse.json(
        { error: 'Sessão inválida: usuário removido' },
        { status: 401 }
      );
    case 'org_deleted':
      return NextResponse.json(
        { error: 'Organização inativa' },
        { status: 403 }
      );
    case 'org_mismatch':
      return NextResponse.json(
        { error: 'Acesso negado: organização inválida' },
        { status: 403 }
      );
  }
}

async function validateSessionUser(session: SessionUserShape) {
  const dbUser = await loadActiveUser(session.user.id);

  if (!dbUser) {
    return { ok: false as const, errorResponse: buildInactiveResponse('not_found') };
  }

  if (dbUser.organizationId !== session.user.organizationId) {
    return { ok: false as const, errorResponse: buildInactiveResponse('org_mismatch') };
  }

  if (dbUser.deletedAt) {
    return { ok: false as const, errorResponse: buildInactiveResponse('deleted') };
  }

  if (dbUser.organization.deletedAt) {
    return { ok: false as const, errorResponse: buildInactiveResponse('org_deleted') };
  }

  return { ok: true as const, dbUser };
}

export async function checkPermission(
  module: PermissionModule,
  action: PermissionAction
): Promise<PermissionCheckResult> {
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

  const safeSession: SessionUserShape = {
    user: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role,
      name: session.user.name,
      email: session.user.email,
    },
  };

  const validation = await validateSessionUser(safeSession);
  if (!validation.ok) {
    return {
      allowed: false,
      session: safeSession,
      errorResponse: validation.errorResponse,
    };
  }

  const dbUser = validation.dbUser;

  if (dbUser.role === 'owner') {
    return {
      allowed: true,
      session: safeSession,
      errorResponse: null,
    };
  }

  const permissions = parsePermissions(dbUser.permissions, dbUser.role as UserRole);
  const allowed = hasPermission(permissions, module, action);

  if (!allowed) {
    return {
      allowed: false,
      session: safeSession,
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
    session: safeSession,
    errorResponse: null,
  };
}

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

  const safeSession: SessionUserShape = {
    user: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role,
      name: session.user.name,
      email: session.user.email,
    },
  };

  const validation = await validateSessionUser(safeSession);

  if (!validation.ok) {
    return {
      authenticated: false,
      session: safeSession,
      errorResponse: validation.errorResponse,
    };
  }

  return {
    authenticated: true,
    session: safeSession,
    errorResponse: null,
  };
}

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

  const safeSession: SessionUserShape = {
    user: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role,
      name: session.user.name,
      email: session.user.email,
    },
  };

  const validation = await validateSessionUser(safeSession);

  if (!validation.ok) {
    return {
      allowed: false,
      session: safeSession,
      errorResponse: validation.errorResponse,
    };
  }

  const dbUser = validation.dbUser;

  if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
    return {
      allowed: false,
      session: safeSession,
      errorResponse: NextResponse.json(
        { error: 'Acesso restrito a administradores' },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    session: safeSession,
    errorResponse: null,
  };
}