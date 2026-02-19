// src/lib/validations/task.ts
// Schemas Zod para API de Tasks e Subtasks — MDS CRM
import { z } from 'zod';
import {
  optionalString,
  optionalStringNullable,
  optionalUuid,
  optionalUuidNullable,
  optionalNumber,
  optionalNumberNullable,
} from './helpers';

// ============================================
// ENUMS
// ============================================

export const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

// ============================================
// CREATE — POST /api/tasks
// ============================================

export const taskCreateSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
  description: optionalString,
  status: taskStatusEnum.default('todo'),
  priority: taskPriorityEnum.default('medium'),
  dueDate: optionalString,
  startDate: optionalString,
  isRecurring: z.boolean().default(false),
  recurrenceRule: optionalString,
  estimatedMinutes: optionalNumber,
  projectId: optionalUuid,
  leadId: optionalUuid,
  assignedToId: optionalUuid,
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

// ============================================
// UPDATE — PUT /api/tasks/[id]
// ============================================

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: optionalStringNullable,
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: optionalStringNullable,
  startDate: optionalStringNullable,
  isRecurring: z.boolean().optional(),
  recurrenceRule: optionalStringNullable,
  estimatedMinutes: optionalNumberNullable,
  actualMinutes: optionalNumberNullable,
  projectId: optionalUuidNullable,
  leadId: optionalUuidNullable,
  assignedToId: optionalUuidNullable,
});

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

// ============================================
// FILTERS — GET /api/tasks (query params)
// ============================================

export const taskFiltersSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedToId: z.string().optional(),
  projectId: z.string().optional(),
  leadId: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  isOverdue: z.string().optional(),
  isToday: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>;

// ============================================
// SUBTASK CREATE — POST /api/tasks/[id]/subtasks
// ============================================

export const subtaskCreateSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
  position: z.number().int().min(0).optional(),
});

export type SubtaskCreateInput = z.infer<typeof subtaskCreateSchema>;

// ============================================
// SUBTASK UPDATE — PUT /api/tasks/[id]/subtasks/[subtaskId]
// ============================================

export const subtaskUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  completed: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export type SubtaskUpdateInput = z.infer<typeof subtaskUpdateSchema>;
