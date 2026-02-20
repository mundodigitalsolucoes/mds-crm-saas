// src/lib/validations/index.ts
// Entry point — parseBody helper + re-exports de todos os schemas
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ============================================
// PARSE BODY — Helper padronizado para todas as APIs
// ============================================

type ParseSuccess<T> = {
  success: true;
  data: T;
};

type ParseError = {
  success: false;
  response: NextResponse;
};

/**
 * Faz safeParse do body com o schema Zod e retorna:
 * - success: true + data tipado
 * - success: false + NextResponse 400 com erros formatados
 *
 * Uso nas APIs:
 * ```
 * const parsed = parseBody(leadCreateSchema, body);
 * if (!parsed.success) return parsed.response;
 * const data = parsed.data;
 * ```
 */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): ParseSuccess<z.output<T>> | ParseError {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Dados inválidos',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

// ============================================
// RE-EXPORTS
// ============================================

// Helpers
export {
  optionalString,
  optionalStringNullable,
  optionalUuid,
  optionalUuidNullable,
  optionalNumber,
  optionalNumberNullable,
  optionalDecimalNullable,
} from './helpers';

// Schemas — Leads
export {
  leadCreateSchema,
  leadUpdateSchema,
} from './lead';

// Schemas — Tasks
export {
  taskCreateSchema,
  taskUpdateSchema,
  taskFiltersSchema,
  subtaskCreateSchema,
  subtaskUpdateSchema,
} from './task';

// Schemas — Agenda
export {
  agendaCreateSchema,
  agendaUpdateSchema,
} from './agenda';

// Schemas — Projects
export {
  projectCreateSchema,
  projectUpdateSchema,
} from './project';

// Schemas — OS
export {
  osCreateSchema,
  osUpdateSchema,
} from './os';

// Schemas — Goals
export {
  goalTypeEnum,
  goalCategoryEnum,
  goalStatusEnum,
  goalCreateSchema,
  goalUpdateSchema,
  goalActionCreateSchema,
  goalActionUpdateSchema,
} from './goal';

// Schemas — Comments
export {
  commentEntityTypeEnum,
  commentCreateSchema,
  commentUpdateSchema,
} from './comment';

// Schemas — Auth
export {
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth';

// Schemas — Users
export {
  userInviteSchema,
} from './user';

// Schemas — Permissions
export {
  userPermissionsUpdateSchema,
} from './permission';

// Schemas — Admin
export {
  adminLoginSchema,
  adminOrgCreateSchema,
  adminOrgUpdateSchema,
  adminUserUpdateSchema,
  adminPlanCreateSchema,
  adminPlanUpdateSchema,
} from './admin';

// Schemas — Notifications
export {
  notificationMarkReadSchema,
} from './notification';

// Schemas — Import
export {
  importLeadsSchema,
} from './import';

// Schemas — Integrations
export {
  metaSelectAccountSchema,
} from './integration';
