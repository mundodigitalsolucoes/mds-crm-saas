// src/lib/validations/import.ts
// Schemas Zod para API de Importação de Leads — MDS CRM
import { z } from 'zod';

// ============================================
// IMPORT — POST /api/import
// ============================================

/** Schema de cada lead individual no payload de importação */
const importLeadItemSchema = z
  .object({
    // Aceita "name" ou "nome"
    name: z.string().optional(),
    nome: z.string().optional(),
    email: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
      z.string().email().nullable().optional()
    ),
    // Aceita "phone" ou "telefone"
    phone: z.string().nullable().optional(),
    telefone: z.string().nullable().optional(),
    // Aceita "company" ou "empresa"
    company: z.string().nullable().optional(),
    empresa: z.string().nullable().optional(),
    // Aceita "source" ou "origem"
    source: z.string().nullable().optional(),
    origem: z.string().nullable().optional(),
    status: z.string().optional().default('new'),
    inKanban: z.preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined;
        if (typeof val === 'string') {
          const normalized = val.trim().toLowerCase();
          if (['true', '1', 'sim', 'yes'].includes(normalized)) return true;
          if (['false', '0', 'nao', 'não', 'no'].includes(normalized)) return false;
        }
        return val;
      },
      z.boolean().optional()
    ),
  })
  .passthrough();

export const importLeadsSchema = z.object({
  leads: z
    .array(importLeadItemSchema, {
      required_error: 'Campo "leads" é obrigatório',
      invalid_type_error: 'Campo "leads" deve ser um array',
    })
    .min(1, 'Array de leads não pode ser vazio')
    .max(10000, 'Máximo de 10.000 leads por importação'),
});

export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;