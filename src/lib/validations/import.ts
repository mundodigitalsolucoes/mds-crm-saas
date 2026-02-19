// src/lib/validations/import.ts
// Schemas Zod para API de Importação de Leads — MDS CRM
import { z } from 'zod';

// ============================================
// IMPORT — POST /api/import
// ============================================

/** Schema de cada lead individual no payload de importação */
const importLeadItemSchema = z.object({
  // Aceita "name" ou "nome"
  name: z.string().optional(),
  nome: z.string().optional(),
  email: z.string().email().nullable().optional(),
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
}).passthrough(); // permite campos extras do CSV sem rejeitar

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
