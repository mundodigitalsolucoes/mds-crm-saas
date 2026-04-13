// src/lib/validations/import.ts
import { z } from 'zod';

const importLeadItemSchema = z
  .object({
    name: z.string().optional(),
    nome: z.string().optional(),

    email: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
      z.string().email().nullable().optional()
    ),

    phone: z.string().nullable().optional(),
    telefone: z.string().nullable().optional(),
    telefone_fixo: z.string().nullable().optional(),

    whatsapp: z.string().nullable().optional(),

    company: z.string().nullable().optional(),
    empresa: z.string().nullable().optional(),

    source: z.string().nullable().optional(),
    origem: z.string().nullable().optional(),

    status: z.string().optional().default('new'),
    score: z.union([z.string(), z.number()]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    valor: z.union([z.string(), z.number()]).optional(),

    product_or_service: z.string().nullable().optional(),
    produto_servico: z.string().nullable().optional(),

    city: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),

    website: z.string().nullable().optional(),
    site: z.string().nullable().optional(),

    instagram: z.string().nullable().optional(),
    facebook: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),

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