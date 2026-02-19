// src/lib/validations/permission.ts
// Schema Zod para API de Permissões de Usuário — MDS CRM
import { z } from 'zod';
import { ALL_MODULES } from '@/lib/permissions';
import type { PermissionModule } from '@/types/permissions';

// ============================================
// HELPERS
// ============================================

/** Schema de um módulo individual: { view, create, edit, delete } — todos boolean */
const modulePermissionSchema = z.object({
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
});

/**
 * Gera o schema de permissões completo baseado em ALL_MODULES.
 * Garante que todos os 11 módulos estejam presentes com as 4 ações.
 */
function buildPermissionsSchema() {
  const shape: Record<string, typeof modulePermissionSchema> = {};
  for (const mod of ALL_MODULES) {
    shape[mod as string] = modulePermissionSchema;
  }
  return z.object(shape).strict('Módulo de permissão desconhecido');
}

const fullPermissionsSchema = buildPermissionsSchema();

// ============================================
// PUT /api/users/[id]/permissions
// ============================================

/**
 * Aceita dois formatos mutuamente exclusivos:
 * 1. `{ resetToDefault: true }` — reseta permissões para o padrão do role
 * 2. `{ permissions: { leads: { view, create, edit, delete }, ... } }` — permissões custom
 */
export const userPermissionsUpdateSchema = z
  .object({
    resetToDefault: z.literal(true).optional(),
    permissions: fullPermissionsSchema.optional(),
  })
  .refine(
    (data) => data.resetToDefault || data.permissions,
    { message: 'Informe "resetToDefault: true" ou um objeto "permissions" válido' }
  )
  .refine(
    (data) => !(data.resetToDefault && data.permissions),
    { message: 'Não é possível enviar "resetToDefault" e "permissions" ao mesmo tempo' }
  );

export type UserPermissionsUpdateInput = z.infer<typeof userPermissionsUpdateSchema>;
