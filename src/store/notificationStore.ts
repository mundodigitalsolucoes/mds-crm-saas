// src/store/notificationStore.ts
import { create } from 'zustand';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (unreadOnly = false) => {
    set({ isLoading: true });

    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.set('unreadOnly', 'true');

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (!response.ok) throw new Error('Erro ao buscar notificações');

      const data = await response.json();

      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        isLoading: false,
      });
    } catch (error) {
      console.error('Erro:', error);
      set({ isLoading: false });
    }
  },

  markAsRead: async (ids: string[]) => {
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) throw new Error('Erro ao marcar notificações');

      const data = await response.json();

      set((state) => ({
        notifications: state.notifications.map((n) =>
          ids.includes(n.id) ? { ...n, read: true, readAt: new Date().toISOString() } : n
        ),
        unreadCount: data.unreadCount,
      }));
    } catch (error) {
      console.error('Erro:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      if (!response.ok) throw new Error('Erro ao marcar notificações');

      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          read: true,
          readAt: new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Erro:', error);
    }
  },
}));
