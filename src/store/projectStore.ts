import { create } from 'zustand';

export type ProjectStatus = 'ativo' | 'pausado' | 'concluido' | 'cancelado';

export interface Project {
  id: number;
  nome: string;
  cliente: string;
  descricao?: string;
  dataInicio: string; // YYYY-MM-DD
  dataFimPrevista: string; // YYYY-MM-DD
  status: ProjectStatus;
  progresso: number; // 0-100
}

interface ProjectStore {
  projects: Project[];

  addProject: (newProject: Omit<Project, 'id' | 'progresso'>) => void;
  updateProject: (id: number, updates: Partial<Project>) => void;
  deleteProject: (id: number) => void;
  getProjectById: (id: number) => Project | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [
    {
      id: 1,
      nome: 'Campanha de Lançamento - Empresa Tech',
      cliente: 'Empresa Tech Ltda.',
      descricao: 'Desenvolvimento e execução de campanha de marketing digital para novo produto.',
      dataInicio: '2026-01-15',
      dataFimPrevista: '2026-03-30',
      status: 'ativo',
      progresso: 30,
    },
    {
      id: 2,
      nome: 'Otimização SEO - Caminhões Almiro',
      cliente: 'Caminhões Almiro',
      descricao: 'Otimização de SEO on-page e off-page para aumentar tráfego orgânico.',
      dataInicio: '2026-02-01',
      dataFimPrevista: '2026-05-15',
      status: 'ativo',
      progresso: 10,
    },
    {
      id: 3,
      nome: 'Criação de Website Institucional',
      cliente: 'Pizzaria do Chef',
      descricao: 'Desenvolvimento de novo website responsivo com integração de sistema de pedidos.',
      dataInicio: '2025-11-01',
      dataFimPrevista: '2026-01-10',
      status: 'concluido',
      progresso: 100,
    },
  ],

  addProject: (newProject) => {
    const nextId = Math.max(0, ...get().projects.map((p) => p.id)) + 1;
    const project: Project = { ...newProject, id: nextId, progresso: 0 };
    set((state) => ({ projects: [project, ...state.projects] }));
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },

  deleteProject: (id) => {
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },

  getProjectById: (id) => get().projects.find((p) => p.id === id),
}));
