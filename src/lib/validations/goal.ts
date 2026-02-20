// src/lib/validations/goal.ts
import { z } from 'zod';
import {
  optionalString,
  optionalStringNullable,
  optionalUuidNullable,
  optionalDecimalNullable,
} from './helpers';

// ============================================
// ENUMS
// ============================================

export const goalTypeEnum = z.enum(['short', 'medium', 'long'], {
  errorMap: () => ({ message: 'Tipo inválido: use short, medium ou long' }),
});

export const goalCategoryEnum = z.enum(['sales', 'marketing', 'general'], {
  errorMap: () => ({ message: 'Categoria inválida: use sales, marketing ou general' }),
});

export const goalStatusEnum = z.enum(['active', 'completed', 'cancelled'], {
  errorMap: () => ({ message: 'Status inválido: use active, completed ou cancelled' }),
});

// ============================================
// GOAL SCHEMAS
// ============================================

export const goalCreateSchema = z.object({
  title:        z.string().min(1, 'Título obrigatório').max(200, 'Máximo 200 caracteres'),
  description:  optionalString,
  type:         goalTypeEnum.default('short'),
  category:     goalCategoryEnum.default('general'),
  targetValue:  optionalDecimalNullable,
  unit:         optionalString,
  startDate:    z.string().optional(),
  deadline:     z.string().optional(),
});

export const goalUpdateSchema = z.object({
  title:         z.string().min(1).max(200).optional(),
  description:   optionalStringNullable,
  type:          goalTypeEnum.optional(),
  category:      goalCategoryEnum.optional(),
  status:        goalStatusEnum.optional(),
  targetValue:   optionalDecimalNullable,
  currentValue:  optionalDecimalNullable,
  unit:          optionalStringNullable,
  startDate:     z.string().optional().nullable(),
  deadline:      z.string().optional().nullable(),
});

// ============================================
// GOAL ACTION SCHEMAS
// ============================================

export const goalActionCreateSchema = z.object({
  title:       z.string().min(1, 'Título obrigatório').max(200, 'Máximo 200 caracteres'),
  description: optionalString,
  position:    z.number().int().min(0).optional(),
});

export const goalActionUpdateSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: optionalStringNullable,
  completed:   z.boolean().optional(),
  position:    z.number().int().min(0).optional(),
});
