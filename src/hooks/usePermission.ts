// src/hooks/usePermission.ts
// Hook para verificar permissões no lado do cliente (React)
// Usa a session do NextAuth para ler as permissões do usuário logado

'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import {
  parsePermissions,
  hasPermission as checkHasPermission,
  isOwner,
  isAdminOrAbove,
} from '@/lib/permissions';
import type {
  PermissionModule,
  PermissionAction,
  UserPermissions,
  UserRole,
} from '@/types/permissions';

interface UsePermissionReturn {
  /** Permissões parseadas do usuário */
  permissions: UserPermissions | null;
  /** Role do usuário */
  role: string | null;
  /** Verifica se tem permissão para módulo + ação */
  hasPermission: (module: PermissionModule, action: PermissionAction) => boolean;
  /** Verifica se pode acessar um módulo (pelo menos view) */
  canAccess: (module: PermissionModule) => boolean;
  /** Se é owner */
  isOwner: boolean;
  /** Se é admin ou owner */
  isAdmin: boolean;
  /** Se está carregando a session */
  isLoading: boolean;
}

/**
 * Hook para verificar permissões do usuário logado.
 * 
 * @example
 * ```tsx
 * const { hasPermission, canAccess, isAdmin } = usePermission();
 * 
 * // Verificar permissão específica
 * if (hasPermission('leads', 'delete')) { ... }
 * 
 * // Verificar acesso ao módulo
 * if (canAccess('reports')) { ... }
 * ```
 */
export function usePermission(): UsePermissionReturn {
  const { data: session, status } = useSession();

  const role = session?.user?.role ?? null;
  const permissionsJson = session?.user?.permissions ?? null;

  // Parsear permissões (memoizado para evitar re-parse)
  const permissions = useMemo(() => {
    if (!permissionsJson || !role) return null;
    return parsePermissions(permissionsJson, role as UserRole);
  }, [permissionsJson, role]);

  // Verificar permissão específica
  const hasPermission = useMemo(() => {
    return (module: PermissionModule, action: PermissionAction): boolean => {
      // Owner sempre pode tudo
      if (role === 'owner') return true;
      if (!permissions) return false;
      return checkHasPermission(permissions, module, action);
    };
  }, [permissions, role]);

  // Verificar acesso ao módulo (pelo menos view)
  const canAccess = useMemo(() => {
    return (module: PermissionModule): boolean => {
      return hasPermission(module, 'view');
    };
  }, [hasPermission]);

  return {
    permissions,
    role,
    hasPermission,
    canAccess,
    isOwner: isOwner(role ?? ''),
    isAdmin: isAdminOrAbove(role ?? ''),
    isLoading: status === 'loading',
  };
}
