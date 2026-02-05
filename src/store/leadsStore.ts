import { create } from 'zustand';

export type LeadStatus = string; // dinâmico

export interface Lead {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  status: LeadStatus;
  origem: string;
  dataCriacao: string;
  valor?: number; // NOVO: valor estimado da oportunidade em R$
}

export interface Stage {
  id: string;
  title: string;
  order: number;
  color: string;
}

interface LeadsStore {
  // Leads
  leads: Lead[];
  addLead: (lead: Omit<Lead, 'id'>) => void;
  updateLead: (id: number, updates: Partial<Lead>) => void;
  deleteLead: (id: number) => void;
  setLeads: (leads: Lead[]) => void;

  // Stages
  stages: Stage[];
  addStage: (stage: Omit<Stage, 'id'>) => void;
  updateStage: (id: string, updates: Partial<Stage>) => void;
  deleteStage: (id: string) => void;
  reorderStages: (newOrder: Stage[]) => void;

  // Column order no kanban
  columnOrder: Record<string, number[]>;
  setColumnOrder: (order: Record<string, number[]>) => void;
  moveLeadInColumns: (leadId: number, fromStage: string, toStage: string, newIndex: number) => void;
}

export const useLeadsStore = create<LeadsStore>((set, get) => ({
  // Initial data
  leads: [
    {
      id: 1,
      nome: 'João Silva',
      email: 'joao@email.com',
      telefone: '(19) 99999-9999',
      empresa: 'Empresa Tech',
      status: 'lead',
      origem: 'Site',
      dataCriacao: '2025-02-01',
      valor: 2500,
    },
    {
      id: 2,
      nome: 'Carlos Cunha',
      email: 'carlimcucu@gmail.com',
      telefone: '17991772563',
      empresa: 'Caminhões Almiro',
      status: 'lead',
      origem: 'Instagram',
      dataCriacao: '2026-02-01',
      valor: 5000,
    },
  ],

  stages: [
    {
      id: 'lead',
      title: 'Lead',
      order: 0,
      color: 'blue',
    },
  ],

  columnOrder: {
    lead: [1, 2],
  },

  // Lead actions
  addLead: (leadData) => {
    const newLead: Lead = {
      ...leadData,
      valor: typeof leadData.valor === 'number' ? leadData.valor : 0,
      id: Math.max(...get().leads.map((l) => l.id), 0) + 1,
    };

    set((state) => ({
      leads: [...state.leads, newLead],
      columnOrder: {
        ...state.columnOrder,
        [newLead.status]: [...(state.columnOrder[newLead.status] || []), newLead.id],
      },
    }));
  },

  updateLead: (id, updates) => {
    const prevLead = get().leads.find((l) => l.id === id);
    if (!prevLead) return;

    set((state) => {
      const updatedLeads = state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l));

      // Se mudou status, move no columnOrder
      let newColumnOrder = { ...state.columnOrder };
      if (updates.status && updates.status !== prevLead.status) {
        newColumnOrder[prevLead.status] = (newColumnOrder[prevLead.status] || []).filter((leadId) => leadId !== id);
        newColumnOrder[updates.status] = [...(newColumnOrder[updates.status] || []), id];
      }

      return {
        leads: updatedLeads,
        columnOrder: newColumnOrder,
      };
    });
  },

  deleteLead: (id) => {
    const lead = get().leads.find((l) => l.id === id);
    if (!lead) return;

    set((state) => ({
      leads: state.leads.filter((l) => l.id !== id),
      columnOrder: {
        ...state.columnOrder,
        [lead.status]: (state.columnOrder[lead.status] || []).filter((leadId) => leadId !== id),
      },
    }));
  },

  setLeads: (leads) => set({ leads }),

  // Stage actions
  addStage: (stageData) => {
    const newStage: Stage = {
      ...stageData,
      id: `stage_${Date.now()}`,
    };
    set((state) => ({
      stages: [...state.stages, newStage].sort((a, b) => a.order - b.order),
      columnOrder: {
        ...state.columnOrder,
        [newStage.id]: [],
      },
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
    if ((state.columnOrder[id] || []).length > 0) {
      alert('Não é possível excluir um estágio que contém leads. Mova os leads primeiro.');
      return;
    }

    set((state) => {
      const newColumnOrder = { ...state.columnOrder };
      delete newColumnOrder[id];

      return {
        stages: state.stages.filter((s) => s.id !== id),
        columnOrder: newColumnOrder,
      };
    });
  },

  reorderStages: (newOrder) => {
    set({ stages: newOrder.map((stage, index) => ({ ...stage, order: index })) });
  },

  setColumnOrder: (order) => set({ columnOrder: order }),

  moveLeadInColumns: (leadId, fromStage, toStage, newIndex) => {
    set((state) => {
      const newColumnOrder = { ...state.columnOrder };

      newColumnOrder[fromStage] = (newColumnOrder[fromStage] || []).filter((id) => id !== leadId);

      const destColumn = [...(newColumnOrder[toStage] || [])];
      destColumn.splice(newIndex, 0, leadId);
      newColumnOrder[toStage] = destColumn;

      return {
        columnOrder: newColumnOrder,
        leads:
          fromStage !== toStage
            ? state.leads.map((l) => (l.id === leadId ? { ...l, status: toStage } : l))
            : state.leads,
      };
    });
  },
}));
