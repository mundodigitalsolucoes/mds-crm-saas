// src/types/task.ts

// ============================================
// ENUMS / TIPOS BASE
// ============================================

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// ============================================
// SUBTASK
// ============================================

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  position: number;
  createdAt: string;
}

export type SubtaskCreate = Pick<Subtask, 'title'> & { position?: number };
export type SubtaskUpdate = Partial<Pick<Subtask, 'title' | 'completed' | 'position'>>;

// ============================================
// ATTACHMENT (ANEXO)
// ============================================

export interface Attachment {
  id: string;
  organizationId: string;
  entityType: 'task' | 'lead' | 'kanban_card' | 'goal' | 'comment';
  entityId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // bytes
  url: string;
  uploadedById?: string;
  uploadedBy?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export type AttachmentCreate = {
  file: File;
  entityType: Attachment['entityType'];
  entityId: string;
};

// ============================================
// COMMENT (COMENTÁRIO)
// ============================================

export interface Comment {
  id: string;
  organizationId: string;
  entityType: 'task' | 'lead' | 'kanban_card' | 'goal';
  entityId: string;
  content: string;
  parentId?: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export type CommentCreate = Pick<Comment, 'content' | 'entityType' | 'entityId'> & {
  parentId?: string;
};
export type CommentUpdate = Pick<Comment, 'content'>;

// ============================================
// TASK (TAREFA PRINCIPAL)
// ============================================

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;

  // Datas
  dueDate?: string;
  startDate?: string;
  completedAt?: string;

  // Recorrência
  isRecurring: boolean;
  recurrenceRule?: string; // RRULE format (iCal)

  // Estimativa de tempo
  estimatedMinutes?: number;
  actualMinutes?: number;

  // Relacionamentos
  projectId?: string;
  project?: {
    id: string;
    title: string;
  };

  leadId?: string;
  lead?: {
    id: string;
    name: string;
  };

  assignedToId?: string;
  assignedTo?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };

  createdById?: string;
  createdBy?: {
    id: string;
    name: string;
  };

  // Agregados
  subtasks?: Subtask[];
  attachments?: Attachment[];
  comments?: Comment[];
  
  // Contadores (para listagens)
  _count?: {
    subtasks: number;
    attachments: number;
    comments: number;
  };

  createdAt: string;
  updatedAt: string;
}

// ============================================
// PAYLOADS PARA CRUD
// ============================================

export type TaskCreate = {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  startDate?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  estimatedMinutes?: number;
  projectId?: string;
  leadId?: string;
  assignedToId?: string;
};

export type TaskUpdate = Partial<TaskCreate> & {
  actualMinutes?: number;
  completedAt?: string;
};

// ============================================
// FILTROS E QUERIES
// ============================================

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assignedToId?: string;
  projectId?: string;
  leadId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  isOverdue?: boolean;
  isToday?: boolean;
  isRecurring?: boolean;
}

export interface TasksResponse {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// HELPERS / DISPLAY
// ============================================

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'border-slate-300 text-slate-600 bg-slate-50',
  medium: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  high: 'border-orange-300 text-orange-700 bg-orange-50',
  urgent: 'border-red-400 text-red-700 bg-red-50',
};
