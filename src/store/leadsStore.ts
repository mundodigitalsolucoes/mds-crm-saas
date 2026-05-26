import { create } from 'zustand';

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
  value: number | string | null;
  productOrService: string | null;
  city: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  notes: string | null;

  assignedToId: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;

  createdById: string | null;
  createdBy?: {
    id: string;
    name: string;
  } | null;

  tags?: {
    id: string;
    name: string;
    slug: string;
    color: string;
    category: string;
    isSystem: boolean;
  }[];

  tasks?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    createdAt: string;
  }[];

  activities?: {
    id: string;
    action: string;
    description: string | null;
    createdAt: string;
  }[];

  chatwootContactId?: number | null;
  chatwootConversationId?: number | null;
  chatwootInboxId?: number | null;
  chatwootConversations?: {
    id: string;
    chatwootId: number;
    status: string;
    channel: string;
    inboxName: string | null;
    contactName: string | null;
    contactPhone: string | null;
    lastMessage: string | null;
    lastMessageAt: string | null;
  }[];

  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  title: string;
  order: number;
  color: string;
  isDefault?: boolean;
  isSystem?: boolean;
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

export type BulkLeadUpdatePayload =
  | { action: 'setInKanban'; inKanban: boolean }
  | { action: 'setStatus'; status: string };

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
  bulkUpdateLeads: (ids: string[], payload: BulkLeadUpdatePayload) => Promise<number | null>;

  fetchStages: () => Promise<void>;
  addStage: (stage: Omit<Stage, 'id'>) => Promise<Stage | null>;
  updateStage: (id: string, updates: Partial<Stage>) => Promise<Stage | null>;
  deleteStage: (id: string) => Promise<boolean>;
  reorderStages: (newOrder: Stage[]) => Promise<void>;

  moveLeadInKanban: (leadId: string, toStatus: string) => Promise<Lead | null>;
}

const LEAD_UPDATE_ALLOWED_KEYS = [
  'name',
  'email',
  'phone',
  'whatsapp',
  'company',
  'position',
  'source',
  'status',
  'inKanban',
  'score',
  'value',
  'productOrService',
  'city',
  'website',
  'instagram',
  'facebook',
  'linkedin',
  'notes',
  'assignedToId',
];

const FALLBACK_STAGES: Stage[] = [
  { id: 'new', title: 'Novo', order: 0, color: 'blue', isDefault: true, isSystem: true },
  { id: 'contacted', title: 'Contactado', order: 1, color: 'yellow', isDefault: true, isSystem: true },
  { id: 'qualified', title: 'Qualificado', order: 2, color: 'orange', isDefault: true, isSystem: true },
  { id: 'proposal', title: 'Proposta', order: 3, color: 'purple', isDefault: true, isSystem: true },
  { id: 'negotiation', title: 'Negociação', order: 4, color: 'yellow', isDefault: true, isSystem: true },
  { id: 'won', title: 'Ganho', order: 5, color: 'green', isDefault: true, isSystem: true },
  { id: 'lost', title: 'Perdido', order: 6, color: 'red', isDefault: true, isSystem: true },
];

export const useLeadsStore = create<LeadsStore>((set) => ({
  leads: [],
  stages: FALLBACK_STAGES,
  isLoading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },

  fetchStages: async () => {
    set({ error: null });

    try {
      const res = await fetch('/api/kanban/stages');

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao buscar etapas do pipeline');
      }

      const data = await res.json();

      set({
        stages:
          Array.isArray(data.stages) && data.stages.length > 0
            ? data.stages
            : FALLBACK_STAGES,
      });
    } catch (error: any) {
      console.error('Erro ao buscar etapas do pipeline:', error);
      set({
        stages: FALLBACK_STAGES,
        error: error.message,
      });
    }
  },

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
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => LEAD_UPDATE_ALLOWED_KEYS.includes(key))
      );

      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanUpdates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar lead');
      }

      const updatedLead = await res.json();

      set((state) => ({
        leads: state.leads.map((lead) =>
          lead.id === id ? { ...lead, ...updatedLead } : lead
        ),
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
        leads: state.leads.filter((lead) => lead.id !== id),
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
        leads: state.leads.filter((lead) => !ids.includes(lead.id)),
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

  bulkUpdateLeads: async (ids, payload) => {
    set({ error: null });

    try {
      const res = await fetch('/api/leads/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ...payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar leads em massa');
      }

      const data = await res.json();
      const updatedCount = Number(data.updatedCount || 0);

      set((state) => ({
        leads: state.leads.map((lead) => {
          if (!ids.includes(lead.id)) return lead;

          if (payload.action === 'setInKanban') {
            return { ...lead, inKanban: payload.inKanban };
          }

          if (payload.action === 'setStatus') {
            return { ...lead, status: payload.status };
          }

          return lead;
        }),
      }));

      return updatedCount;
    } catch (error: any) {
      console.error('Erro ao atualizar leads em massa:', error);
      set({ error: error.message });
      return null;
    }
  },

  moveLeadInKanban: async (leadId, toStatus) => {
    set({ error: null });

    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao mover lead no pipeline');
      }

      const updatedLead = await res.json();

      set((state) => ({
        leads: state.leads.map((lead) =>
          lead.id === leadId ? { ...lead, ...updatedLead } : lead
        ),
      }));

      return updatedLead;
    } catch (error: any) {
      console.error('Erro ao mover lead no pipeline:', error);
      set({ error: error.message });
      return null;
    }
  },

  addStage: async (stageData) => {
    set({ error: null });

    try {
      const res = await fetch('/api/kanban/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar etapa');
      }

      const newStage = await res.json();

      set((state) => ({
        stages: [...state.stages, newStage].sort((a, b) => a.order - b.order),
      }));

      return newStage;
    } catch (error: any) {
      console.error('Erro ao criar etapa:', error);
      set({ error: error.message });
      return null;
    }
  },

  updateStage: async (id, updates) => {
    set({ error: null });

    try {
      const res = await fetch(`/api/kanban/stages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar etapa');
      }

      const updatedStage = await res.json();

      set((state) => ({
        stages: state.stages
          .map((stage) => (stage.id === id ? updatedStage : stage))
          .sort((a, b) => a.order - b.order),
      }));

      return updatedStage;
    } catch (error: any) {
      console.error('Erro ao atualizar etapa:', error);
      set({ error: error.message });
      return null;
    }
  },

  deleteStage: async (id) => {
    set({ error: null });

    try {
      const res = await fetch(`/api/kanban/stages/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao excluir etapa');
      }

      set((state) => ({
        stages: state.stages.filter((stage) => stage.id !== id),
      }));

      return true;
    } catch (error: any) {
      console.error('Erro ao excluir etapa:', error);
      set({ error: error.message });
      return false;
    }
  },

  reorderStages: async (newOrder) => {
    const orderedStages = newOrder.map((stage, index) => ({
      ...stage,
      order: index,
    }));

    set({ stages: orderedStages });

    try {
      await Promise.all(
        orderedStages.map((stage) =>
          fetch(`/api/kanban/stages/${stage.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: stage.order }),
          })
        )
      );
    } catch (error) {
      console.error('Erro ao reordenar etapas:', error);
    }
  },
}));