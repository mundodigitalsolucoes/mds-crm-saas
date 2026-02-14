// src/store/agendaStore.ts
// Store da Agenda — migrada para consumir API /api/agenda
import { create } from 'zustand';
import axios from 'axios';
import type { AgendaEvent, CreateAgendaEventInput, UpdateAgendaEventInput, EventStatus, EventType } from '@/types/agenda';

interface AgendaFilters {
  status?: EventStatus;
  type?: EventType;
  startDate?: string;
  endDate?: string;
  leadId?: string;
  projectId?: string;
  assignedToId?: string;
  search?: string;
}

interface AgendaPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AgendaStore {
  // Estado
  events: AgendaEvent[];
  selectedEvent: AgendaEvent | null;
  loading: boolean;
  error: string | null;
  filters: AgendaFilters;
  pagination: AgendaPagination;

  // Ações de CRUD
  fetchEvents: (filters?: AgendaFilters) => Promise<void>;
  fetchEventById: (id: string) => Promise<AgendaEvent | null>;
  addEvent: (data: CreateAgendaEventInput) => Promise<AgendaEvent>;
  updateEvent: (id: string, updates: UpdateAgendaEventInput) => Promise<AgendaEvent>;
  deleteEvent: (id: string) => Promise<void>;

  // Ações auxiliares
  setSelectedEvent: (event: AgendaEvent | null) => void;
  setFilters: (filters: AgendaFilters) => void;
  clearError: () => void;

  // Atalhos úteis
  getEventById: (id: string) => AgendaEvent | undefined;
  getEventsByDate: (date: string) => AgendaEvent[];
  getUpcomingEvents: (limit?: number) => AgendaEvent[];
}

export const useAgendaStore = create<AgendaStore>((set, get) => ({
  // Estado inicial
  events: [],
  selectedEvent: null,
  loading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },

  // ============================================
  // FETCH — Listar eventos com filtros
  // ============================================
  fetchEvents: async (filters?: AgendaFilters) => {
    set({ loading: true, error: null });

    try {
      const currentFilters = filters || get().filters;
      const params = new URLSearchParams();

      // Adicionar filtros como query params
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.type) params.set('type', currentFilters.type);
      if (currentFilters.startDate) params.set('startDate', currentFilters.startDate);
      if (currentFilters.endDate) params.set('endDate', currentFilters.endDate);
      if (currentFilters.leadId) params.set('leadId', currentFilters.leadId);
      if (currentFilters.projectId) params.set('projectId', currentFilters.projectId);
      if (currentFilters.assignedToId) params.set('assignedToId', currentFilters.assignedToId);
      if (currentFilters.search) params.set('search', currentFilters.search);

      params.set('page', String(get().pagination.page));
      params.set('limit', String(get().pagination.limit));

      const { data } = await axios.get(`/api/agenda?${params.toString()}`);

      set({
        events: data.events,
        pagination: data.pagination,
        filters: currentFilters,
        loading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Erro ao carregar eventos';
      set({ error: message, loading: false });
      console.error('[AgendaStore] Erro ao buscar eventos:', error);
    }
  },

  // ============================================
  // FETCH BY ID — Buscar evento específico
  // ============================================
  fetchEventById: async (id: string) => {
    try {
      const { data } = await axios.get(`/api/agenda/${id}`);
      set({ selectedEvent: data });
      return data;
    } catch (error: any) {
      console.error('[AgendaStore] Erro ao buscar evento:', error);
      return null;
    }
  },

  // ============================================
  // CREATE — Criar novo evento
  // ============================================
  addEvent: async (eventData: CreateAgendaEventInput) => {
    set({ loading: true, error: null });

    try {
      const { data } = await axios.post('/api/agenda', eventData);

      // Adicionar ao estado local (início da lista)
      set((state) => ({
        events: [data, ...state.events],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
        loading: false,
      }));

      return data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Erro ao criar evento';
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  // ============================================
  // UPDATE — Atualizar evento existente
  // ============================================
  updateEvent: async (id: string, updates: UpdateAgendaEventInput) => {
    set({ loading: true, error: null });

    try {
      const { data } = await axios.put(`/api/agenda/${id}`, updates);

      // Atualizar no estado local
      set((state) => ({
        events: state.events.map((e) => (e.id === id ? data : e)),
        selectedEvent: state.selectedEvent?.id === id ? data : state.selectedEvent,
        loading: false,
      }));

      return data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Erro ao atualizar evento';
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  // ============================================
  // DELETE — Excluir evento
  // ============================================
  deleteEvent: async (id: string) => {
    set({ loading: true, error: null });

    try {
      await axios.delete(`/api/agenda/${id}`);

      // Remover do estado local
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        selectedEvent: state.selectedEvent?.id === id ? null : state.selectedEvent,
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
        loading: false,
      }));
    } catch (error: any) {
      const message = error.response?.data?.error || 'Erro ao excluir evento';
      set({ error: message, loading: false });
      throw new Error(message);
    }
  },

  // ============================================
  // AÇÕES AUXILIARES
  // ============================================
  setSelectedEvent: (event) => set({ selectedEvent: event }),

  setFilters: (filters) => {
    set({ filters, pagination: { ...get().pagination, page: 1 } });
    // Recarregar eventos com novos filtros
    get().fetchEvents(filters);
  },

  clearError: () => set({ error: null }),

  // ============================================
  // GETTERS (leitura do estado local)
  // ============================================
  getEventById: (id: string) => get().events.find((e) => e.id === id),

  getEventsByDate: (date: string) => {
    return get().events.filter((e) => {
      // Comparar apenas a parte da data (YYYY-MM-DD)
      const eventDate = typeof e.date === 'string'
        ? e.date.substring(0, 10)
        : new Date(e.date).toISOString().substring(0, 10);
      return eventDate === date;
    });
  },

  getUpcomingEvents: (limit = 5) => {
    const today = new Date().toISOString().substring(0, 10);
    return get()
      .events
      .filter((e) => {
        const eventDate = typeof e.date === 'string'
          ? e.date.substring(0, 10)
          : new Date(e.date).toISOString().substring(0, 10);
        return eventDate >= today && e.status === 'agendado';
      })
      .sort((a, b) => {
        const dateA = `${a.date}${a.startTime || ''}`;
        const dateB = `${b.date}${b.startTime || ''}`;
        return dateA.localeCompare(dateB);
      })
      .slice(0, limit);
  },
}));
