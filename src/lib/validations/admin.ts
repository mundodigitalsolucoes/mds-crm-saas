// src/lib/validations/admin.ts
// Schemas Zod para APIs do SuperAdmin — MDS CRM
import { z } from 'zod';
import { planFeaturesWriteSchema, serializedPlanFeaturesSchema } from './plan-features';
import { brandingUpdateSchema } from './branding';

// ============================================
// HELPERS
// ============================================

/** Normaliza slug: lowercase, sem acentos, só a-z0-9 e hífens */
const slugTransform = z
  .string()
  .transform((v) =>
    v
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  );

// ============================================
// AUTH — POST /api/admin/auth
// ============================================

export const adminLoginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255)
    .transform((v) => v.trim().toLowerCase()),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(1, 'Senha é obrigatória'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// ============================================
// ORGANIZATIONS — POST /api/admin/organizations
// ============================================

export const adminOrgCreateSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(1, 'Nome é obrigatório')
    .max(255, 'Nome deve ter no máximo 255 caracteres')
    .transform((v) => v.trim()),
  slug: z
    .string({ required_error: 'Slug é obrigatório' })
    .min(1, 'Slug é obrigatório')
    .max(255)
    .pipe(slugTransform),
  plan: z.string().max(50).optional().default('trial'),
  maxUsers: z.coerce.number().int().min(-1).optional().default(5),
  maxLeads: z.coerce.number().int().min(-1).optional().default(100),
  maxProjects: z.coerce.number().int().min(-1).optional().default(10),
  maxOs: z.coerce.number().int().min(-1).optional().default(10),
  // Se true, copia limites do Plan ao invés de usar os valores manuais
  syncFromPlan: z.boolean().optional().default(true),
});

export type AdminOrgCreateInput = z.infer<typeof adminOrgCreateSchema>;

// ============================================
// ORGANIZATIONS — PUT /api/admin/organizations/[id]
// ============================================

export const adminOrgUpdateSchema = z.object({
  whiteLabel: z.boolean().optional(),
  branding: brandingUpdateSchema.optional(),
  name: z
    .string()
    .min(1, 'Nome não pode ser vazio')
    .max(255)
    .transform((v) => v.trim())
    .optional(),
  slug: z
    .string()
    .min(1, 'Slug não pode ser vazio')
    .max(255)
    .pipe(slugTransform)
    .optional(),
  plan: z.string().max(50).optional(),
  planStatus: z.enum(['active', 'cancelled', 'past_due', 'trial_expired']).optional(),
  maxUsers: z.coerce.number().int().min(-1).optional(),
  maxLeads: z.coerce.number().int().min(-1).optional(),
  maxProjects: z.coerce.number().int().min(-1).optional(),
  maxOs: z.coerce.number().int().min(-1).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  // Se true e plan mudou, copia limites do novo Plan
  syncFromPlan: z.boolean().optional().default(false),
}).strict('Campo não permitido na atualização de organização');

export type AdminOrgUpdateInput = z.infer<typeof adminOrgUpdateSchema>;

// ============================================
// USERS — PUT /api/admin/users/[id]
// ============================================

export const adminUserCreateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(12).max(128),
  role: z.enum(['owner', 'admin', 'manager', 'user']),
}).strict();

export const adminUserUpdateSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  role: z.enum(['owner', 'admin', 'manager', 'user'], {
    errorMap: () => ({ message: 'Cargo inválido. Use: owner, admin, manager ou user' }),
  }),
}).strict('Campo não permitido na atualização de usuário');

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

// ============================================
// PLANS — POST /api/admin/plans
// ============================================

export const adminPlanCreateSchema = z.object({
  name: z
    .string({ required_error: 'Nome (slug) é obrigatório' })
    .min(1, 'Nome (slug) é obrigatório')
    .max(50)
    .transform((v) => v.trim().toLowerCase()),
  displayName: z
    .string({ required_error: 'Nome de exibição é obrigatório' })
    .min(1, 'Nome de exibição é obrigatório')
    .max(255)
    .transform((v) => v.trim()),
  description: z.string().max(1000).nullable().optional().default(null),
  price: z.coerce.number().min(0, 'Preço não pode ser negativo').optional().default(0),
  interval: z.enum(['month', 'year']).optional().default('month'),
  maxUsers: z.coerce.number().int().min(-1).optional().default(5),
  maxLeads: z.coerce.number().int().min(-1).optional().default(100),
  maxProjects: z.coerce.number().int().min(-1).optional().default(10),
  maxOs: z.coerce.number().int().min(-1).optional().default(20),
  maxWhatsappInstances: z.coerce.number().int().min(-1).optional().default(1),
  features: planFeaturesWriteSchema().optional().default('[]'),
});

export type AdminPlanCreateInput = z.infer<typeof adminPlanCreateSchema>;

// ============================================
// PLANS — PUT /api/admin/plans/[id]
// ============================================

export const adminPlanUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome não pode ser vazio')
    .max(50)
    .transform((v) => v.trim().toLowerCase())
    .optional(),
  displayName: z
    .string()
    .min(1, 'Nome de exibição não pode ser vazio')
    .max(255)
    .transform((v) => v.trim())
    .optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.coerce.number().min(0, 'Preço não pode ser negativo').optional(),
  interval: z.enum(['month', 'year']).optional(),
  maxUsers: z.coerce.number().int().min(-1).optional(),
  maxLeads: z.coerce.number().int().min(-1).optional(),
  maxProjects: z.coerce.number().int().min(-1).optional(),
  maxOs: z.coerce.number().int().min(-1).optional(),
  maxWhatsappInstances: z.coerce.number().int().min(-1).optional(),
  // Contextual validation against the current plan is done by the PUT handler.
  // Omitted features must not prevent a partial edit of a malformed legacy plan.
  features: serializedPlanFeaturesSchema.optional(),
  isActive: z.boolean().optional(),
  // Se true, propaga os novos limites para TODAS as orgs que usam este plano
  propagateToOrgs: z.boolean().optional().default(false),
}).strict('Campo não permitido na atualização de plano');

export type AdminPlanUpdateInput = z.infer<typeof adminPlanUpdateSchema>;
