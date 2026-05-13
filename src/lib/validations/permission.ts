// src/lib/validations/permission.ts
// Schema Zod para API de Permissões de Usuário — MDS CRM
import { z } from 'zod';
import { ALL_MODULES } from '@/lib/permissions';

// ============================================
// HELPERS
// ============================================

const modulePermissionSchema = z.object({
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
});

function buildPermissionsSchema() {
  const shape: Record<string, typeof modulePermissionSchema> = {};
  for (const mod of ALL_MODULES) {
    shape[mod as string] = modulePermissionSchema;
  }
  return z.object(shape).strict('Módulo de permissão desconhecido');
}

const fullPermissionsSchema = buildPermissionsSchema();

export const atendimentoVisibilitySchema = z.enum([
  'all',
  'assigned',
  'team',
]);

export const userPermissionsUpdateSchema = z
  .object({
    resetToDefault: z.literal(true).optional(),
    permissions: fullPermissionsSchema.optional(),
    atendimentoVisibility: atendimentoVisibilitySchema.optional(),
  })
  .refine(
    (data) => data.resetToDefault || data.permissions || data.atendimentoVisibility,
    { message: 'Informe permissões, reset ou visibilidade do Atendimento' }
  )
  .refine(
    (data) => !(data.resetToDefault && data.permissions),
    { message: 'Não é possível enviar "resetToDefault" e "permissions" ao mesmo tempo' }
  );

export type UserPermissionsUpdateInput = z.infer<typeof userPermissionsUpdateSchema>;