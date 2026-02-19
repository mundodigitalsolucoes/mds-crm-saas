// src/lib/validations/os.ts
// Schemas Zod para API de Ordens de Serviço — MDS CRM
import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const osTypeEnum = z.enum(['implantacao_mds', 'manutencao', 'custom']);

export const osStatusEnum = z.enum([
  'em_planejamento', 'em_execucao', 'aguardando_cliente', 'concluida', 'cancelada',
]);

export const osPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

// ============================================
// CREATE — POST /api/os
// ============================================

export const osCreateSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
  description: z.string().max(5000).optional().nullable(),
  type: osTypeEnum.default('custom'),
  status: osStatusEnum.default('em_planejamento'),
  priority: osPriorityEnum.default('medium'),
  progress: z.number().min(0).max(100).default(0),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  projectId: z.string().uuid('Projeto ID inválido').optional().nullable(),
  assignedToId: z.string().uuid('Usuário ID inválido').optional().nullable(),
  pilares: z.any().optional().default({}),
  notes: z.string().max(10000).optional().nullable(),
});

export type OSCreateInput = z.infer<typeof osCreateSchema>;

// ============================================
// UPDATE — PUT /api/os/[id]
// ============================================

export const osUpdateSchema = z.object({
  title: z.string().min(1, 'Título não pode ser vazio').max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  type: osTypeEnum.optional(),
  status: osStatusEnum.optional(),
  priority: osPriorityEnum.optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  projectId: z.string().uuid('Projeto ID inválido').optional().nullable(),
  assignedToId: z.string().uuid('Usuário ID inválido').optional().nullable(),
  pilares: z.any().optional(),
  notes: z.string().max(10000).optional().nullable(),
});

export type OSUpdateInput = z.infer<typeof osUpdateSchema>;
