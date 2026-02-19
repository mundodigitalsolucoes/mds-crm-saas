// src/lib/validations/helpers.ts
// Helpers Zod reutilizáveis para todas as validações do MDS CRM
import { z } from 'zod';

// ============================================
// STRING HELPERS
// ============================================

/**
 * String opcional — "" vira undefined
 * Uso: campos texto opcionais (description, notes, etc.)
 */
export const optionalString = z.preprocess(
  (val) => {
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  },
  z.string().optional()
);

/**
 * String opcional nullable — undefined = não enviado, null/"" = limpar campo
 * Uso: campos texto opcionais em updates (onde null significa "remover valor")
 */
export const optionalStringNullable = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null || val.trim() === '') return null;
    return val;
  });

// ============================================
// UUID HELPERS
// ============================================

/**
 * UUID opcional — "" vira undefined
 * Uso: campos de relacionamento opcionais em criação (projectId, leadId, etc.)
 */
export const optionalUuid = z.preprocess(
  (val) => {
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  },
  z.string().uuid('ID inválido').optional()
);

/**
 * UUID opcional nullable — undefined = não enviado, null/"" = desvincular
 * Uso: campos de relacionamento em updates (onde null = remover vínculo)
 */
export const optionalUuidNullable = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null || val.trim() === '') return null;
    return val;
  })
  .pipe(z.string().uuid('ID inválido').optional().nullable());

// ============================================
// NUMBER HELPERS
// ============================================

/**
 * Number opcional — ""/"null"/undefined vira undefined, string numérica vira number
 * Uso: campos numéricos opcionais em criação (score, estimatedMinutes, etc.)
 */
export const optionalNumber = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = typeof val === 'string' ? Number(val) : val;
    return typeof num === 'number' && !isNaN(num) ? num : undefined;
  },
  z.number().optional()
);

/**
 * Number opcional nullable — undefined = não enviado, null/"" = limpar
 * Uso: campos numéricos em updates (onde null = remover valor)
 */
export const optionalNumberNullable = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null || val === '') return null;
    const num = typeof val === 'string' ? Number(val) : val;
    return typeof num === 'number' && !isNaN(num) ? num : null;
  });

// ============================================
// DECIMAL HELPER (para campos Prisma Decimal)
// ============================================

/**
 * Decimal opcional nullable — aceita number ou string numérica
 * Uso: campos monetários (value, budget, spent, etc.)
 */
export const optionalDecimalNullable = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null || val === '') return null;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return typeof num === 'number' && !isNaN(num) ? num : null;
  });
