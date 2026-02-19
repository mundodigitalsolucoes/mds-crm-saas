// src/components/NotificationBell.tsx
// Sino de notificações com badge, dropdown e polling de 30s
// Integrado ao notificationStore (Zustand) existente

'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNotificationStore } from '@/store/notificationStore';

// ============================================
// MAPA DE ÍCONE/COR POR TIPO
// ============================================

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  task_assigned:  { color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  task_due:       { color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  task_completed: { color: 'text-green-400',   bg: 'bg-green-500/10' },
  lead_created:   { color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  lead_assigned:  { color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  os_created:     { color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  os_assigned:    { color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  os_updated:     { color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  goal_completed: { color: 'text-green-400',   bg: 'bg-green-500/10' },
  mention:        { color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  invite_sent:    { color: 'text-teal-400',    bg: 'bg-teal-500/10' },
};

const DEFAULT_CONFIG = { color: 'text-gray-400', bg: 'bg-gray-500/10' };

// Mapa de entityType → rota
const ENTITY_ROUTE: Record<string, string> = {
  task: '/tasks',
  lead: '/leads',
  os:   '/os',
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Polling de 30s ──────────────────────────────────────────
  useEffect(() => {
    fetchNotifications(); // fetch inicial

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30_000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── Refetch ao abrir o dropdown ──────────────────────────────
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // ── Fechar ao clicar fora ────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Clicar em notificação → marca lida + navega ──────────────
  async function handleClickNotification(id: string, entityType?: string | null) {
    await markAsRead([id]);
    if (entityType && ENTITY_ROUTE[entityType]) {
      router.push(ENTITY_ROUTE[entityType]);
    }
    setOpen(false);
  }

  // ── Marcar todas como lidas ──────────────────────────────────
  async function handleMarkAllAsRead() {
    await markAllAsRead();
  }

  const badgeCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Botão sino ── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notificações"
      >
        <Bell size={22} />

        {/* Badge contador */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {badgeCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[520px] flex flex-col rounded-xl border border-white/10 bg-gray-900 shadow-2xl z-50">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-indigo-400" />
              <span className="font-semibold text-white text-sm">Notificações</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                  {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Marcar todas como lidas */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  title="Marcar todas como lidas"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-white/5 transition-colors"
                >
                  <CheckCheck size={16} />
                </button>
              )}
              {/* Fechar */}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/5">

            {/* Loading */}
            {isLoading && notifications.length === 0 && (
              <div className="flex flex-col gap-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Vazio */}
            {!isLoading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                <Bell size={32} className="opacity-30" />
                <p className="text-sm">Nenhuma notificação ainda</p>
              </div>
            )}

            {/* Itens */}
            {notifications.map((n) => {
              const config = TYPE_CONFIG[n.type] ?? DEFAULT_CONFIG;

              return (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n.id, n.entityType)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${
                    !n.read ? 'bg-indigo-500/5' : ''
                  }`}
                >
                  {/* Dot indicador não lida */}
                  <div className="flex-shrink-0 mt-1 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bg}`}>
                      <Bell size={14} className={config.color} />
                    </div>
                    {!n.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-gray-900" />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug truncate ${n.read ? 'text-gray-300' : 'text-white'}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>

                  {/* Ícone lida / link */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1 mt-1">
                    {n.read ? (
                      <Check size={13} className="text-gray-600" />
                    ) : (
                      n.entityType && ENTITY_ROUTE[n.entityType] && (
                        <ExternalLink size={13} className="text-gray-500" />
                      )
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Rodapé */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/10 text-center">
              <p className="text-xs text-gray-500">
                Mostrando as {notifications.length} notificações mais recentes
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
