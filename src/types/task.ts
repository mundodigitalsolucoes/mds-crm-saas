// src/types/task.ts

export type TaskStatus =
  | 'nova' // Corresponde a "Pendente" no seu exemplo, mas agora mais explícito
  | 'em_aprovacao'
  | 'aprovada'
  | 'em_andamento'
  | 'concluida';

export type TaskPriority = 'baixa' | 'media' | 'alta';

export interface Task {
  id: number;

  title: string;
  description?: string;

  status: TaskStatus;
  priority: TaskPriority;

  assignee?: string; // Responsável
  dueDate?: string; // Data limite (no formato YYYY-MM-DD)

  projectId: number;
  osId?: number; // Quando a tarefa é vinculada a uma OS

  createdAt: string; // Data de criação (ISO)
  doneAt?: string; // Data de conclusão (ISO, se concluída)
}
