// src/lib/validations/integration.ts
// Schemas Zod para APIs de Integrações — MDS CRM
import { z } from 'zod';

// ============================================
// META — POST /api/integrations/meta/select-account
// ============================================

export const metaSelectAccountSchema = z.object({
  adAccountId: z
    .string({ required_error: 'adAccountId é obrigatório' })
    .min(1, 'adAccountId é obrigatório'),
  adAccountName: z
    .string()
    .optional()
    .default(''),
});

export type MetaSelectAccountInput = z.infer<typeof metaSelectAccountSchema>;
