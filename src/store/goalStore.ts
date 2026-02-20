// src/store/goalStore.ts
import { create } from 'zustand';

// ============================================
// TIPOS
// ============================================

export type GoalType     = 'short' | 'medium' | 'long';
export type GoalCategory = 'sales' | 'marketing' | 'general';
export type GoalStatus   = 'active' | 'completed' | 'cancelled';

export interface GoalAction {
  id:          string;
  goalId:      string;
  title:       string;
  description: string | null;
  completed:   boolean;
  completedAt: string | null;
  position:    number;
  createdAt:   string;
}

export interface Goal {
  id:           string;
  organizationId: string;
  title:        string;
  description:  string | null;
  type:         GoalType;
  category:     GoalCategory;
  status:       GoalStatus;
  targetValue:  number | null;
  currentValue: number;
  unit:         string | null;
  startDate:    string | null;
  deadline:     string | null;
  completedAt:  string | null;
  createdAt:    string;
  updatedAt:    string;
  createdBy:    { id: string; name: string; avatarUrl: string | null };
  actions:      GoalAction[];
  _count:       { actions: number };
}

export interface GoalCreate {
  title:       string;
  description?: string;
  type:        GoalType;
  category:    GoalCategory;
  targetValue?: number | null;
  unit?:       string;
  startDate?:  string;
  deadline?:   string;
}

export interface GoalUpdate {
  title?:        string;
  description?:  string | null;
  type?:         GoalType;
  category?:     GoalCategory;
  status?:       GoalStatus;
  targetValue?:  number | null;
  currentValue?: number | null;
  unit?:         string | null;
  startDate?:    string | null;
  deadline?:     string | null;
}

export interface GoalActionCreate {
  title:       string;
  description?: string;
  position?:   number;
}

export interface GoalActionUpdate {
  title?:       string;
  description?: string | null;
  completed?:   boolean;
  position?:    number;
}

export interface GoalFilters {
  status?:   GoalStatus;
  type?:     GoalType;
  category?: GoalCategory;
  search?:   string;
}

// ============================================
// STORE INTERFACE
// ============================================

interface GoalStore {
  // State
  goals:       Goal[];
  currentGoal: Goal | null;
  isLoading:   boolean;
  error:       string | null;
  filters:     GoalFilters;
  pagination:  {
    page:       number;
    limit:      number;
    total:      number;
    totalPages: number;
  };

  // Actions — Goals
  fetchGoals:   (filters?: GoalFilters) => Promise<void>;
  fetchGoalById:(id: string) => Promise<Goal | null>;
  createGoal:   (data: GoalCreate) => Promise<Goal | null>;
  updateGoal:   (id: string, data: GoalUpdate) => Promise<Goal | null>;
  deleteGoal:   (id: string) => Promise<boolean>;
  completeGoal: (id: string) => Promise<Goal | null>;

  // Actions — GoalActions
  addAction:    (goalId: string, data: GoalActionCreate) => Promise<GoalAction | null>;
  updateAction: (goalId: string, actionId: string, data: GoalActionUpdate) => Promise<GoalAction | null>;
  deleteAction: (goalId: string, actionId: string) => Promise<boolean>;
  toggleAction: (goalId: string, actionId: string) => Promise<void>;

  // Filters
  setFilters:   (filters: GoalFilters) => void;
  clearFilters: () => void;
  setPage:      (page: number) => void;

  // Helpers
  getTypeLabel:     (type: GoalType) => string;
  getCategoryLabel: (category: GoalCategory) => string;
  getStatusLabel:   (status: GoalStatus) => string;
  getStatusColor:   (status: GoalStatus) => string;
  getCategoryColor: (category: GoalCategory) => string;
  getProgress:      (goal: Goal) => number;
}

const API_BASE = '/api/goals';

// ============================================
// STORE
// ============================================

export const useGoalStore = create<GoalStore>((set, get) => ({
  // ── Initial State ────────────────────────────────────────────────────────
  goals:       [],
  currentGoal: null,
  isLoading:   false,
  error:       null,
  filters:     {},
  pagination:  { page: 1, limit: 20, total: 0, totalPages: 0 },

  // ── fetchGoals ───────────────────────────────────────────────────────────
  fetchGoals: async (filters?: GoalFilters) => {
    set({ isLoading: true, error: null });

    try {
      const currentFilters = filters ?? get().filters;
      const { page, limit } = get().pagination;

      const params = new URLSearchParams();
      params.set('page',  page.toString());
      params.set('limit', limit.toString());

      if (currentFilters.status)   params.set('status',   currentFilters.status);
      if (currentFilters.type)     params.set('type',     currentFilters.type);
      if (currentFilters.category) params.set('category', currentFilters.category);
      if (currentFilters.search)   params.set('search',   currentFilters.search);

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar metas');

      const data = await res.json();

      set({
        goals:    data.goals,
        filters:  currentFilters,
        pagination: {
          page:       data.pagination.page,
          limit:      data.pagination.limit,
          total:      data.pagination.total,
          totalPages: data.pagination.totalPages,
        },
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // ── fetchGoalById ────────────────────────────────────────────────────────
  fetchGoalById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/${id}`);
      if (!res.ok) throw new Error('Meta não encontrada');

      const goal: Goal = await res.json();
      set({ currentGoal: goal, isLoading: false });
      return goal;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  // ── createGoal ───────────────────────────────────────────────────────────
  createGoal: async (data: GoalCreate) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(API_BASE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar meta');
      }

      const goal: Goal = await res.json();

      set((state) => ({
        goals:     [goal, ...state.goals],
        isLoading: false,
      }));

      return goal;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  // ── updateGoal ───────────────────────────────────────────────────────────
  updateGoal: async (id: string, data: GoalUpdate) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar meta');
      }

      const updated: Goal = await res.json();

      set((state) => ({
        goals:       state.goals.map((g) => g.id === id ? updated : g),
        currentGoal: state.currentGoal?.id === id ? updated : state.currentGoal,
        isLoading:   false,
      }));

      return updated;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  // ── deleteGoal ───────────────────────────────────────────────────────────
  deleteGoal: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir meta');

      set((state) => ({
        goals:       state.goals.filter((g) => g.id !== id),
        currentGoal: state.currentGoal?.id === id ? null : state.currentGoal,
        isLoading:   false,
      }));

      return true;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return false;
    }
  },

  // ── completeGoal — atalho para marcar como concluída ────────────────────
  completeGoal: async (id: string) => {
    return get().updateGoal(id, { status: 'completed' });
  },

  // ── addAction ────────────────────────────────────────────────────────────
  addAction: async (goalId: string, data: GoalActionCreate) => {
    try {
      const res = await fetch(`${API_BASE}/${goalId}/actions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Erro ao criar ação');

      const action: GoalAction = await res.json();

      // Atualizar goal na lista e currentGoal
      const patchGoal = (g: Goal): Goal => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          actions: [...g.actions, action],
          _count:  { actions: g._count.actions + 1 },
        };
      };

      set((state) => ({
        goals:       state.goals.map(patchGoal),
        currentGoal: state.currentGoal ? patchGoal(state.currentGoal) : null,
      }));

      return action;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  // ── updateAction ─────────────────────────────────────────────────────────
  updateAction: async (goalId: string, actionId: string, data: GoalActionUpdate) => {
    try {
      const res = await fetch(`${API_BASE}/${goalId}/actions/${actionId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Erro ao atualizar ação');

      const updated: GoalAction = await res.json();

      const patchGoal = (g: Goal): Goal => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          actions: g.actions.map((a) => a.id === actionId ? updated : a),
        };
      };

      set((state) => ({
        goals:       state.goals.map(patchGoal),
        currentGoal: state.currentGoal ? patchGoal(state.currentGoal) : null,
      }));

      return updated;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  // ── deleteAction ─────────────────────────────────────────────────────────
  deleteAction: async (goalId: string, actionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${goalId}/actions/${actionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Erro ao excluir ação');

      const patchGoal = (g: Goal): Goal => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          actions: g.actions.filter((a) => a.id !== actionId),
          _count:  { actions: Math.max(0, g._count.actions - 1) },
        };
      };

      set((state) => ({
        goals:       state.goals.map(patchGoal),
        currentGoal: state.currentGoal ? patchGoal(state.currentGoal) : null,
      }));

      return true;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  // ── toggleAction ─────────────────────────────────────────────────────────
  toggleAction: async (goalId: string, actionId: string) => {
    const goal   = get().goals.find((g) => g.id === goalId)
                ?? get().currentGoal;
    const action = goal?.actions.find((a) => a.id === actionId);
    if (!action) return;

    await get().updateAction(goalId, actionId, { completed: !action.completed });
  },

  // ── Filters ──────────────────────────────────────────────────────────────
  setFilters: (filters: GoalFilters) => {
    set({ filters, pagination: { ...get().pagination, page: 1 } });
    get().fetchGoals(filters);
  },

  clearFilters: () => {
    set({ filters: {}, pagination: { ...get().pagination, page: 1 } });
    get().fetchGoals({});
  },

  setPage: (page: number) => {
    set((state) => ({ pagination: { ...state.pagination, page } }));
    get().fetchGoals();
  },

  // ── Helpers ──────────────────────────────────────────────────────────────
  getTypeLabel: (type: GoalType) => {
    const labels: Record<GoalType, string> = {
      short:  'Curto Prazo',
      medium: 'Médio Prazo',
      long:   'Longo Prazo',
    };
    return labels[type] ?? type;
  },

  getCategoryLabel: (category: GoalCategory) => {
    const labels: Record<GoalCategory, string> = {
      sales:     'Vendas',
      marketing: 'Marketing',
      general:   'Geral',
    };
    return labels[category] ?? category;
  },

  getStatusLabel: (status: GoalStatus) => {
    const labels: Record<GoalStatus, string> = {
      active:    'Ativa',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    };
    return labels[status] ?? status;
  },

  getStatusColor: (status: GoalStatus) => {
    const colors: Record<GoalStatus, string> = {
      active:    'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] ?? 'bg-gray-100 text-gray-700';
  },

  getCategoryColor: (category: GoalCategory) => {
    const colors: Record<GoalCategory, string> = {
      sales:     'bg-emerald-100 text-emerald-700',
      marketing: 'bg-purple-100 text-purple-700',
      general:   'bg-slate-100 text-slate-700',
    };
    return colors[category] ?? 'bg-gray-100 text-gray-700';
  },

  // Retorna 0-100. Seguro para targetValue null/zero.
  getProgress: (goal: Goal) => {
    if (!goal.targetValue || goal.targetValue === 0) return 0;
    const pct = (goal.currentValue / goal.targetValue) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  },
}));
