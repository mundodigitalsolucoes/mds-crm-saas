// src/lib/validations/lead.ts
import { z } from 'zod';
import {
  optionalStringNullable,
  optionalUuid,
  optionalUuidNullable,
  optionalDecimalNullable,
} from './helpers';

const leadStatusEnum = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
]);

const leadSourceEnum = z.enum([
  'manual',
  'chatwoot',
  'website',
  'referral',
  'meta_ads',
  'google_ads',
  'instagram',
  'linkedin',
  'facebook',
  'csv_import',
]);

const optionalScoreCreate = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'string' ? Number(val) : val;
    return typeof num === 'number' && !isNaN(num) ? num : 0;
  },
  z.number().int().min(0).max(100)
);

const optionalScoreUpdate = z.preprocess(
  (val) => {
    if (val === undefined) return undefined;
    if (val === null || val === '') return null;
    const num = typeof val === 'string' ? Number(val) : val;
    return typeof num === 'number' && !isNaN(num) ? num : val;
  },
  z.number().int().min(0).max(100).nullable()
);

export const leadCreateSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(1, 'Nome é obrigatório')
    .max(255, 'Nome deve ter no máximo 255 caracteres')
    .transform((v) => v.trim()),

  email: z
    .string()
    .email('E-mail inválido')
    .max(255)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  phone: z
    .string()
    .max(50, 'Telefone fixo deve ter no máximo 50 caracteres')
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  whatsapp: z
    .string()
    .max(50, 'WhatsApp deve ter no máximo 50 caracteres')
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  company: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  position: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  source: leadSourceEnum.optional().default('manual'),
  status: leadStatusEnum.optional().default('new'),
  inKanban: z.boolean().optional().default(true),
  score: optionalScoreCreate,
  value: optionalDecimalNullable,

  productOrService: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  city: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  website: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  instagram: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  facebook: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  linkedin: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  notes: z
    .string()
    .max(5000, 'Notas devem ter no máximo 5000 caracteres')
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  assignedToId: optionalUuid.transform((v) => v || null),

  utmSource: optionalStringNullable,
  utmMedium: optionalStringNullable,
  utmCampaign: optionalStringNullable,
  utmContent: optionalStringNullable,
  utmTerm: optionalStringNullable,
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export const leadUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Nome não pode ser vazio')
      .max(255)
      .transform((v) => v.trim())
      .optional(),

    email: z
      .string()
      .email('E-mail inválido')
      .max(255)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    phone: z
      .string()
      .max(50)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    whatsapp: z
      .string()
      .max(50)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    company: z
      .string()
      .max(255)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    position: z
      .string()
      .max(255)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    source: leadSourceEnum.nullable().optional(),
    status: leadStatusEnum.optional(),
    inKanban: z.boolean().optional(),
    score: optionalScoreUpdate,
    value: optionalDecimalNullable,

    productOrService: z
      .string()
      .max(255)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    city: z
      .string()
      .max(255)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    website: z
      .string()
      .max(500)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    instagram: z
      .string()
      .max(500)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    facebook: z
      .string()
      .max(500)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    linkedin: z
      .string()
      .max(500)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    notes: z
      .string()
      .max(5000)
      .nullable()
      .transform((v) => v?.trim() || null)
      .optional(),

    assignedToId: optionalUuidNullable,
  })
  .strict('Campo não permitido na atualização de lead');

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;