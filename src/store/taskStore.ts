// src/store/taskStore.ts
import { create } from 'zustand';
import type {
  Task,
  TaskCreate,
  TaskUpdate,
  TaskFilters,
  TasksResponse,
  Subtask,
  SubtaskCreate,
  SubtaskUpdate,
  TaskStatus,
  TaskPriority,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from '@/types/task';

interface TaskStore {
  // State
  tasks: Task[];
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;
  filters: TaskFilters;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  // Actions - Tasks
  fetchTasks: (filters?: TaskFilters) => Promise<void>;
  fetchTaskById: (id: string) => Promise<Task | null>;
  createTask: (data: TaskCreate) => Promise<Task | null>;
  updateTask: (id: string, data: TaskUpdate) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  toggleTaskStatus: (id: string) => Promise<void>;

  // Actions - Subtasks
  addSubtask: (taskId: string, data: SubtaskCreate) => Promise<Subtask | null>;
  updateSubtask: (taskId: string, subtaskId: string, data: SubtaskUpdate) => Promise<Subtask | null>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<boolean>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;

  // Actions - Filters
  setFilters: (filters: TaskFilters) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;

  // Helpers
  getStatusLabel: (status: TaskStatus) => string;
  getStatusColor: (status: TaskStatus) => string;
  getPriorityLabel: (priority: TaskPriority) => string;
  getPriorityColor: (priority: TaskPriority) => string;

  // Computed
  getTodayTasks: () => Task[];
  getOverdueTasks: () => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
}

const API_BASE = '/api/tasks';

export const useTaskStore = create<TaskStore>((set, get) => ({
  // Initial State
  tasks: [],
  currentTask: null,
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  },

  // Fetch Tasks
  fetchTasks: async (filters?: TaskFilters) => {
    set({ isLoading: true, error: null });

    try {
      const currentFilters = filters || get().filters;
      const { page, pageSize } = get().pagination;

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());

      if (currentFilters.status) {
        const statuses = Array.isArray(currentFilters.status)
          ? currentFilters.status.join(',')
          : currentFilters.status;
        params.set('status', statuses);
      }
      if (currentFilters.priority) {
        const priorities = Array.isArray(currentFilters.priority)
          ? currentFilters.priority.join(',')
          : currentFilters.priority;
        params.set('priority', priorities);
      }
      if (currentFilters.assignedToId) params.set('assignedToId', currentFilters.assignedToId);
      if (currentFilters.projectId) params.set('projectId', currentFilters.projectId);
      if (currentFilters.leadId) params.set('leadId', currentFilters.leadId);
      if (currentFilters.dueDateFrom) params.set('dueDateFrom', currentFilters.dueDateFrom);
      if (currentFilters.dueDateTo) params.set('dueDateTo', currentFilters.dueDateTo);
      if (currentFilters.search) params.set('search', currentFilters.search);
      if (currentFilters.isOverdue) params.set('isOverdue', 'true');
      if (currentFilters.isToday) params.set('isToday', 'true');

      const response = await fetch(`${API_BASE}?${params.toString()}`);
      if (!response.ok) throw new Error('Erro ao buscar tarefas');

      const data: TasksResponse = await response.json();

      set({
        tasks: data.tasks,
        pagination: {
          page: data.page,
          pageSize: data.pageSize,
          total: data.total,
          totalPages: data.totalPages,
        },
        filters: currentFilters,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Fetch Single Task
  fetchTaskById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/${id}`);
      if (!response.ok) throw new Error('Tarefa não encontrada');

      const task: Task = await response.json();
      set({ currentTask: task, isLoading: false });
      return task;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  // Create Task
  createTask: async (data: TaskCreate) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao criar tarefa');
      }

      const task: Task = await response.json();

      set((state) => ({
        tasks: [task, ...state.tasks],
        isLoading: false,
      }));

      return task;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  // Update Task
  updateTask: async (id: string, data: TaskUpdate) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao atualizar tarefa');
      }

      const updatedTask: Task = await response.json();

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updatedTask : t)),
        currentTask: state.currentTask?.id === id ? updatedTask : state.currentTask,
        isLoading: false,
      }));

      return updatedTask;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  // Delete Task
  deleteTask: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao deletar tarefa');

      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        currentTask: state.currentTask?.id === id ? null : state.currentTask,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return false;
    }
  },

  // Toggle Task Status
  toggleTaskStatus: async (id: string) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    await get().updateTask(id, { status: newStatus });
  },

  // Add Subtask
  addSubtask: async (taskId: string, data: SubtaskCreate) => {
    try {
      const response = await fetch(`${API_BASE}/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Erro ao criar subtarefa');

      const subtask: Subtask = await response.json();

      // Atualizar task local
      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subtasks: [...(t.subtasks || []), subtask],
            _count: {
              ...t._count,
              subtasks: (t._count?.subtasks || 0) + 1,
            },
          };
        }),
        currentTask:
          state.currentTask?.id === taskId
            ? {
                ...state.currentTask,
                subtasks: [...(state.currentTask.subtasks || []), subtask],
              }
            : state.currentTask,
      }));

      return subtask;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  // Update Subtask
  updateSubtask: async (taskId: string, subtaskId: string, data: SubtaskUpdate) => {
    try {
      const response = await fetch(`${API_BASE}/${taskId}/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Erro ao atualizar subtarefa');

      const updatedSubtask: Subtask = await response.json();

      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subtasks: t.subtasks?.map((st) =>
              st.id === subtaskId ? updatedSubtask : st
            ),
          };
        }),
        currentTask:
          state.currentTask?.id === taskId
            ? {
                ...state.currentTask,
                subtasks: state.currentTask.subtasks?.map((st) =>
                  st.id === subtaskId ? updatedSubtask : st
                ),
              }
            : state.currentTask,
      }));

      return updatedSubtask;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  // Delete Subtask
  deleteSubtask: async (taskId: string, subtaskId: string) => {
    try {
      const response = await fetch(`${API_BASE}/${taskId}/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao deletar subtarefa');

      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subtasks: t.subtasks?.filter((st) => st.id !== subtaskId),
            _count: {
              ...t._count,
              subtasks: Math.max(0, (t._count?.subtasks || 0) - 1),
            },
          };
        }),
        currentTask:
          state.currentTask?.id === taskId
            ? {
                ...state.currentTask,
                subtasks: state.currentTask.subtasks?.filter((st) => st.id !== subtaskId),
              }
            : state.currentTask,
      }));

      return true;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  // Toggle Subtask
  toggleSubtask: async (taskId: string, subtaskId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    const subtask = task?.subtasks?.find((st) => st.id === subtaskId);
    if (!subtask) return;

    await get().updateSubtask(taskId, subtaskId, { completed: !subtask.completed });
  },

  // Filters
  setFilters: (filters: TaskFilters) => {
    set({ filters, pagination: { ...get().pagination, page: 1 } });
    get().fetchTasks(filters);
  },

  clearFilters: () => {
    set({ filters: {}, pagination: { ...get().pagination, page: 1 } });
    get().fetchTasks({});
  },

  setPage: (page: number) => {
    set((state) => ({ pagination: { ...state.pagination, page } }));
    get().fetchTasks();
  },

  // Helpers
  getStatusLabel: (status: TaskStatus) => {
    const labels: Record<TaskStatus, string> = {
      todo: 'A Fazer',
      in_progress: 'Em Andamento',
      done: 'Concluída',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  },

  getStatusColor: (status: TaskStatus) => {
    const colors: Record<TaskStatus, string> = {
      todo: 'bg-slate-100 text-slate-700',
      in_progress: 'bg-blue-100 text-blue-700',
      done: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  },

  getPriorityLabel: (priority: TaskPriority) => {
    const labels: Record<TaskPriority, string> = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente',
    };
    return labels[priority] || priority;
  },

  getPriorityColor: (priority: TaskPriority) => {
    const colors: Record<TaskPriority, string> = {
      low: 'border-slate-300 text-slate-600 bg-slate-50',
      medium: 'border-yellow-300 text-yellow-700 bg-yellow-50',
      high: 'border-orange-300 text-orange-700 bg-orange-50',
      urgent: 'border-red-400 text-red-700 bg-red-50',
    };
    return colors[priority] || 'border-gray-300 text-gray-600';
  },

  // Computed
  getTodayTasks: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().tasks.filter((t) => t.dueDate?.startsWith(today));
  },

  getOverdueTasks: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().tasks.filter(
      (t) => t.dueDate && t.dueDate < today && t.status !== 'done' && t.status !== 'cancelled'
    );
  },

  getTasksByStatus: (status: TaskStatus) => {
    return get().tasks.filter((t) => t.status === status);
  },
}));
