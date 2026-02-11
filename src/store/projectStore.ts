import { create } from 'zustand';

// Tipos alinhados com o model Prisma MarketingProject
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  client: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  budget: number;
  spent: number;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  ownerId: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    tasks: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProjectPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ProjectStore {
  projects: Project[];
  pagination: ProjectPagination | null;
  loading: boolean;
  error: string | null;

  // Ações CRUD via API
  fetchProjects: (params?: { search?: string; status?: string; page?: number; limit?: number }) => Promise<void>;
  addProject: (data: {
    title: string;
    description?: string;
    client?: string;
    status?: ProjectStatus;
    priority?: ProjectPriority;
    budget?: number;
    progress?: number;
    startDate?: string;
    endDate?: string;
  }) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;
  getProjectById: (id: string) => Project | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  pagination: null,
  loading: false,
  error: null,

  // Buscar projetos da API
  fetchProjects: async (params) => {
    set({ loading: true, error: null });
    try {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());

      const response = await fetch(`/api/projects?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar projetos');
      }

      const data = await response.json();
      set({
        projects: data.projects,
        pagination: data.pagination,
        loading: false,
      });
    } catch (error: any) {
      console.error('Erro ao buscar projetos:', error);
      set({ error: error.message, loading: false });
    }
  },

  // Criar projeto via API
  addProject: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao criar projeto');
      }

      const project = await response.json();
      set((state) => ({
        projects: [project, ...state.projects],
        loading: false,
      }));
      return project;
    } catch (error: any) {
      console.error('Erro ao criar projeto:', error);
      set({ error: error.message, loading: false });
      return null;
    }
  },

  // Atualizar projeto via API
  updateProject: async (id, data) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao atualizar projeto');
      }

      const updated = await response.json();
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated : p)),
      }));
      return updated;
    } catch (error: any) {
      console.error('Erro ao atualizar projeto:', error);
      set({ error: error.message });
      return null;
    }
  },

  // Excluir projeto via API
  deleteProject: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao excluir projeto');
      }

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      }));
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir projeto:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Buscar projeto por ID (local)
  getProjectById: (id) => get().projects.find((p) => p.id === id),
}));
