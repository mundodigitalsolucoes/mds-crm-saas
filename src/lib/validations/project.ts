// src/lib/validations/project.ts
// Schemas Zod para API de Projetos — MDS CRM
import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const projectStatusEnum = z.enum([
  'planning', 'active', 'paused', 'completed', 'cancelled',
]);

export const projectPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

// ============================================
// CREATE — POST /api/projects
// ============================================

export const projectCreateSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
  description: z.string().max(5000).optional().nullable(),
  client: z.string().max(255).optional().nullable(),
  status: projectStatusEnum.default('planning'),
  priority: projectPriorityEnum.default('medium'),
  budget: z.number().min(0, 'Orçamento não pode ser negativo').default(0),
  spent: z.number().min(0, 'Gasto não pode ser negativo').default(0),
  progress: z.number().min(0).max(100).default(0),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

// ============================================
// UPDATE — PUT /api/projects/[id]
// ============================================

export const projectUpdateSchema = z.object({
  title: z.string().min(1, 'Título não pode ser vazio').max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  client: z.string().max(255).optional().nullable(),
  status: projectStatusEnum.optional(),
  priority: projectPriorityEnum.optional(),
  budget: z.number().min(0, 'Orçamento não pode ser negativo').optional(),
  spent: z.number().min(0, 'Gasto não pode ser negativo').optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
