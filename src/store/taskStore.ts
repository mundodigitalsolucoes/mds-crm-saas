// src/store/taskStore.ts
import { create } from 'zustand';
import { useOSStore } from './osStore';
import type { Task, TaskPriority, TaskStatus } from '@/types/task';

const nowISO = () => new Date().toISOString().split('T')[0];

type NewTaskPayload = Omit<Task, 'id' | 'createdAt' | 'doneAt'>;

interface TasksCompletionMetric {
  total: number;
  completed: number;
  percent: number; // 0..100
}

interface TaskStore {
  tasks: Task[];

  addTask: (newTaskData: NewTaskPayload) => void;
  addTasks: (newTasks: NewTaskPayload[]) => void;

  updateTask: (id: number, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: number) => void;
  toggleTaskCompletion: (id: number) => void;

  getTaskById: (id: number) => Task | undefined;
  getTasksByOS: (osId: number) => Task[];

  // NOVO: métrica para exibir em OS (sem afetar progresso principal)
  getTasksCompletionForOS: (osId: number) => TasksCompletionMetric;

  getTaskStatusDisplay: (status: TaskStatus) => string;
  getTaskStatusColorClass: (status: TaskStatus) => string;
  getTaskPriorityColorClass: (priority: TaskPriority) => string;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [
    {
      id: 1,
      title: 'Onboarding Cliente X',
      description: 'Concluir o onboarding do novo cliente Empresa Tech.',
      status: 'nova',
      priority: 'alta',
      assignee: 'Fábio',
      dueDate: '2026-02-04',
      createdAt: '2026-02-01',
      projectId: 1,
      osId: 1,
    },
    {
      id: 2,
      title: 'Criar documentação da API',
      description: 'Documentar todos os endpoints com Swagger.',
      status: 'em_andamento',
      priority: 'media',
      assignee: 'João Oliveira',
      dueDate: '2026-02-12',
      createdAt: '2026-02-05',
      projectId: 2,
      osId: 2,
    },
    {
      id: 3,
      title: 'Testes de integração',
      description: 'Criar suite de testes automatizados para o sistema.',
      status: 'nova',
      priority: 'media',
      assignee: 'Maria Costa',
      dueDate: '2026-02-15',
      createdAt: '2026-02-06',
      projectId: 1,
      osId: 1,
    },
    {
      id: 4,
      title: 'Revisar relatório mensal',
      description: 'Revisar o relatório de desempenho do mês de janeiro.',
      status: 'concluida',
      priority: 'baixa',
      assignee: 'Fábio',
      dueDate: '2026-02-02',
      createdAt: '2026-01-30',
      doneAt: '2026-02-02',
      projectId: 1,
      osId: 1,
    },
  ],

  addTask: (newTaskData) => {
    const nextId = Math.max(0, ...get().tasks.map((t) => t.id)) + 1;

    const task: Task = {
      id: nextId,
      createdAt: nowISO(),
      ...newTaskData,
      status: newTaskData.status || 'nova',
      priority: newTaskData.priority || 'media',
    };

    // se já criar como concluída, registra doneAt
    if (task.status === 'concluida' && !task.doneAt) {
      task.doneAt = nowISO();
    }

    set((state) => ({ tasks: [task, ...state.tasks] }));

    // Se a tarefa estiver vinculada a OS, avise o osStore para recalcular
    if (task.osId) {
      useOSStore.getState().recalculateAndSetOSProgress(task.osId);
    }
  },

  addTasks: (newTasks) => {
    // Faz em loop para reaproveitar a lógica e disparar recalculo por OS
    newTasks.forEach((taskData) => {
      get().addTask(taskData);
    });
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== id) return task;

        const updatedTask: Task = { ...task, ...updates } as Task;

        // Ajuste doneAt conforme status
        if (updatedTask.status === 'concluida' && !updatedTask.doneAt) {
          updatedTask.doneAt = nowISO();
        } else if (updatedTask.status !== 'concluida' && updatedTask.doneAt) {
          delete updatedTask.doneAt;
        }

        // Se mudou status e tem OS vinculada, recalcula
        if (updatedTask.osId && updatedTask.status !== task.status) {
          useOSStore.getState().recalculateAndSetOSProgress(updatedTask.osId);
        }

        return updatedTask;
      }),
    }));
  },

  deleteTask: (id) => {
    const taskToDelete = get().tasks.find((t) => t.id === id);

    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }));

    if (taskToDelete?.osId) {
      useOSStore.getState().recalculateAndSetOSProgress(taskToDelete.osId);
    }
  },

  toggleTaskCompletion: (id) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== id) return task;

        const newStatus: TaskStatus = task.status === 'concluida' ? 'nova' : 'concluida';
        const updatedTask: Task = {
          ...task,
          status: newStatus,
          doneAt: newStatus === 'concluida' ? nowISO() : undefined,
        };

        if (updatedTask.osId) {
          useOSStore.getState().recalculateAndSetOSProgress(updatedTask.osId);
        }

        return updatedTask;
      }),
    }));
  },

  getTaskById: (id) => get().tasks.find((task) => task.id === id),
  getTasksByOS: (osId) => get().tasks.filter((task) => task.osId === osId),

  getTasksCompletionForOS: (osId) => {
    const tasks = get().tasks.filter((t) => t.osId === osId);
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'concluida').length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percent };
  },

  getTaskStatusDisplay: (status) => {
    switch (status) {
      case 'nova':
        return 'Nova';
      case 'em_aprovacao':
        return 'Em Aprovação';
      case 'aprovada':
        return 'Aprovada';
      case 'em_andamento':
        return 'Em Andamento';
      case 'concluida':
        return 'Concluída';
      default:
        return status;
    }
  },

  getTaskStatusColorClass: (status) => {
    switch (status) {
      case 'nova':
        return 'bg-blue-100 text-blue-800';
      case 'em_aprovacao':
        return 'bg-purple-100 text-purple-800';
      case 'aprovada':
        return 'bg-indigo-100 text-indigo-800';
      case 'em_andamento':
        return 'bg-yellow-100 text-yellow-800';
      case 'concluida':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  },

  getTaskPriorityColorClass: (priority) => {
    switch (priority) {
      case 'baixa':
        return 'border-green-300 text-green-700';
      case 'media':
        return 'border-yellow-300 text-yellow-700';
      case 'alta':
        return 'border-red-300 text-red-700';
      default:
        return 'border-gray-300 text-gray-700';
    }
  },
}));
