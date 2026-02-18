// src/components/PermissionSync.tsx
// Componente invisível que sincroniza permissões do banco com a session JWT
// Roda no layout do app para garantir que mudanças de permissão reflitam sem relogar

'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

/**
 * Intervalo entre sincronizações (em ms).
 * 60 segundos = bom equilíbrio entre atualização e performance.
 */
const SYNC_INTERVAL = 60_000;

export default function PermissionSync() {
  const { data: session, status, update } = useSession();
  const lastSyncRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const syncPermissions = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;

        const data = await res.json();
        const freshPerms = data.permissions ?? null;
        const freshRole = data.role ?? null;

        // Comparar com o que está na session para evitar updates desnecessários
        const currentPerms = (session.user as any).permissions ?? null;
        const currentRole = (session.user as any).role ?? null;

        const permsChanged = JSON.stringify(freshPerms) !== JSON.stringify(currentPerms);
        const roleChanged = freshRole !== currentRole;

        if (permsChanged || roleChanged) {
          // Atualizar a session (trigger 'update' no callback JWT)
          await update({
            permissions: freshPerms,
            role: freshRole,
          });
          lastSyncRef.current = JSON.stringify({ permissions: freshPerms, role: freshRole });
        }
      } catch {
        // Silencioso - não quebrar a UX por erro de sync
      }
    };

    // Sync imediato ao montar
    syncPermissions();

    // Sync periódico
    intervalRef.current = setInterval(syncPermissions, SYNC_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Componente invisível
  return null;
}
