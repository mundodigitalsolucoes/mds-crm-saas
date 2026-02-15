// src/components/PermissionGate.tsx
// Componente que renderiza filhos apenas se o usuário tiver permissão.
// Útil para esconder botões, menus e seções inteiras da UI.

'use client';

import React from 'react';
import { usePermission } from '@/hooks/usePermission';
import type { PermissionModule, PermissionAction } from '@/types/permissions';

interface PermissionGateProps {
  /** Módulo que requer permissão */
  module: PermissionModule;
  /** Ação que requer permissão (default: 'view') */
  action?: PermissionAction;
  /** Conteúdo a renderizar se tiver permissão */
  children: React.ReactNode;
  /** Conteúdo alternativo se NÃO tiver permissão (opcional) */
  fallback?: React.ReactNode;
  /** Se true, requer role admin/owner ao invés de checar permissão */
  requireAdmin?: boolean;
}

/**
 * Renderiza filhos condicionalmente baseado nas permissões do usuário.
 * 
 * @example
 * ```tsx
 * // Esconder botão de deletar lead
 * <PermissionGate module="leads" action="delete">
 *   <button onClick={handleDelete}>Excluir Lead</button>
 * </PermissionGate>
 * 
 * // Com fallback
 * <PermissionGate module="reports" fallback={<p>Sem acesso</p>}>
 *   <ReportsPage />
 * </PermissionGate>
 * 
 * // Apenas admins
 * <PermissionGate module="settings" requireAdmin>
 *   <SettingsPanel />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  module,
  action = 'view',
  children,
  fallback = null,
  requireAdmin = false,
}: PermissionGateProps) {
  const { hasPermission, isAdmin, isLoading } = usePermission();

  // Enquanto carrega a session, não renderiza nada (evita flash)
  if (isLoading) return null;

  // Se requer admin, verificar role
  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>;
  }

  // Verificar permissão granular
  if (!hasPermission(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * HOC para proteger páginas inteiras.
 * Redireciona para dashboard se não tiver permissão.
 * 
 * @example
 * ```tsx
 * export default withPermission(ReportsPage, 'reports', 'view');
 * ```
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  module: PermissionModule,
  action: PermissionAction = 'view'
) {
  return function ProtectedComponent(props: P) {
    const { hasPermission, isLoading } = usePermission();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      );
    }

    if (!hasPermission(module, action)) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-200 mb-2">
            Acesso Restrito
          </h2>
          <p className="text-gray-400">
            Você não tem permissão para acessar esta página.
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Entre em contato com o administrador da sua organização.
          </p>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
