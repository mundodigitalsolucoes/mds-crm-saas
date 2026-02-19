// src/lib/validations/comment.ts
// Schemas Zod para API de Comments — MDS CRM
import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const commentEntityTypeEnum = z.enum([
  'task', 'lead', 'kanban_card', 'goal',
]);

// ============================================
// CREATE — POST /api/comments
// ============================================

export const commentCreateSchema = z.object({
  content: z
    .string({ required_error: 'Conteúdo é obrigatório' })
    .min(1, 'Conteúdo é obrigatório')
    .max(10000, 'Conteúdo deve ter no máximo 10.000 caracteres')
    .transform((v) => v.trim()),
  entityType: commentEntityTypeEnum,
  entityId: z.string().uuid('entityId deve ser um UUID válido'),
  parentId: z.string().uuid('parentId deve ser um UUID válido').optional(),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

// ============================================
// UPDATE — PUT /api/comments/[id]
// ============================================

export const commentUpdateSchema = z.object({
  content: z
    .string({ required_error: 'Conteúdo é obrigatório' })
    .min(1, 'Conteúdo não pode ser vazio')
    .max(10000, 'Conteúdo deve ter no máximo 10.000 caracteres')
    .transform((v) => v.trim()),
}).strict('Campo não permitido na atualização de comentário');

export type CommentUpdateInput = z.infer<typeof commentUpdateSchema>;
