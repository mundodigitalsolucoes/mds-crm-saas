import { create } from 'zustand';

// Interface alinhada com o schema Prisma
export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  position: string | null;
  source: string | null;
  status: string;
  inKanban: boolean;
  score: number;
  value: number | null;
  productOrService: string | null;
  city: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  notes: string | null;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  createdById: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  title: string;
  order: number;
  color: string;
}

export interface LeadFilters {
  search?: string;
  status?: string;
  source?: string;
  city?: string;
  inKanban?: string;
  hasWhatsapp?: string;
  hasWebsite?: string;
  minScore?: number | '';
  page?: number;
}

interface LeadsStore {
  leads: Lead[];
  stages: Stage[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  fetchLeads: (params?: LeadFilters) => Promise<void>;
  addLead: (data: Partial<Lead>) => Promise<Lead | null>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<Lead | null>;
  deleteLead: (id: string) => Promise<boolean>;
  bulkDeleteLeads: (ids: string[], confirmationText: string) => Promise<number | null>;

  addStage: (stage: Omit<Stage, 'id'>) => void;
  updateStage: (id: string, updates: Partial<Stage>) => void;
  deleteStage: (id: string) => void;
  reorderStages: (newOrder: Stage[]) => void;

  moveLeadInKanban: (leadId: string, toStatus: string) => Promise<Lead | null>;
}

export const useLeadsStore = create<LeadsStore>((set, get) => ({
  leads: [],
  isLoading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },

  stages: [
    { id: 'new', title: 'Novo', order: 0, color: 'blue' },
    { id: 'contacted', title: 'Contactado', order: 1, color: 'yellow' },
    { id: 'qualified', title: 'Qualificado', order: 2, color: 'orange' },
    { id: 'proposal', title: 'Proposta', order: 3, color: 'purple' },
    { id: 'negotiation', title: 'Negociação', order: 4, color: 'yellow' },
    { id: 'won', title: 'Ganho', order: 5, color: 'green' },
    { id: 'lost', title: 'Perdido', order: 6, color: 'red' },
  ],

  fetchLeads: async (params) => {
    set({ isLoading: true, error: null });

    try {
      const query = new URLSearchParams();

      if (params?.search) query.set('search', params.search);
      if (params?.status) query.set('status', params.status);
      if (params?.source) query.set('source', params.source);
      if (params?.city) query.set('city', params.city);
      if (params?.inKanban) query.set('inKanban', params.inKanban);
      if (params?.hasWhatsapp) query.set('hasWhatsapp', params.hasWhatsapp);
      if (params?.hasWebsite) query.set('hasWebsite', params.hasWebsite);
      if (params?.minScore !== '' && params?.minScore !== undefined) {
        query.set('minScore', String(params.minScore));
      }
      if (params?.page) query.set('page', String(params.page));

      const res = await fetch(`/api/leads?${query.toString()}`);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao buscar leads');
      }

      const data = await res.json();

      set({
        leads: data.leads,
        pagination: data.pagination,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Erro ao buscar leads:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  addLead: async (data) => {
    set({ error: null });

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar lead');
      }

      const newLead = await res.json();

      set((state) => ({
        leads: [newLead, ...state.leads],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
      }));

      return newLead;
    } catch (error: any) {
      console.error('Erro ao criar lead:', error);
      set({ error: error.message });
      return null;
    }
  },

  updateLead: async (id, updates) => {
    set({ error: null });

    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar lead');
      }

      const updatedLead = await res.json();

      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? updatedLead : l)),
      }));

      return updatedLead;
    } catch (error: any) {
      console.error('Erro ao atualizar lead:', error);
      set({ error: error.message });
      return null;
    }
  },

  deleteLead: async (id) => {
    set({ error: null });

    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao excluir lead');
      }

      set((state) => ({
        leads: state.leads.filter((l) => l.id !== id),
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
      }));

      return true;
    } catch (error: any) {
      console.error('Erro ao excluir lead:', error);
      set({ error: error.message });
      return false;
    }
  },

  bulkDeleteLeads: async (ids, confirmationText) => {
    set({ error: null });

    try {
      const res = await fetch('/api/leads/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, confirmationText }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao excluir leads em massa');
      }

      const data = await res.json();
      const deletedCount = Number(data.deletedCount || 0);

      set((state) => ({
        leads: state.leads.filter((l) => !ids.includes(l.id)),
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - deletedCount),
        },
      }));

      return deletedCount;
    } catch (error: any) {
      console.error('Erro ao excluir leads em massa:', error);
      set({ error: error.message });
      return null;
    }
  },

  moveLeadInKanban: async (leadId, toStatus) => {
    return get().updateLead(leadId, { status: toStatus });
  },

  addStage: (stageData) => {
    const newStage: Stage = {
      ...stageData,
      id: `stage_${Date.now()}`,
    };
    set((state) => ({
      stages: [...state.stages, newStage].sort((a, b) => a.order - b.order),
    }));
  },

  updateStage: (id, updates) => {
    set((state) => ({
      stages: state.stages.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteStage: (id) => {
    const state = get();
    if (state.stages.length <= 1) return;

    const hasLeads = state.leads.some((l) => l.status === id && l.inKanban);
    if (hasLeads) {
      alert('Não é possível excluir um estágio que contém leads no pipeline. Mova os leads primeiro.');
      return;
    }

    set((state) => ({
      stages: state.stages.filter((s) => s.id !== id),
    }));
  },

  reorderStages: (newOrder) => {
    set({ stages: newOrder.map((stage, index) => ({ ...stage, order: index })) });
  },
}));