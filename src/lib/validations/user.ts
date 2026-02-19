// src/lib/validations/user.ts
// Schemas Zod para API de Users/Invite — MDS CRM
import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

const inviteRoleEnum = z.enum(['admin', 'manager', 'user'], {
  errorMap: () => ({ message: 'Cargo inválido. Use: admin, manager ou user' }),
});

// ============================================
// INVITE — POST /api/users/invite
// ============================================

export const userInviteSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(255, 'Nome deve ter no máximo 255 caracteres')
    .transform((v) => v.trim()),
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255, 'Email deve ter no máximo 255 caracteres')
    .transform((v) => v.trim().toLowerCase()),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(8, 'A senha deve ter no mínimo 8 caracteres')
    .max(128, 'A senha deve ter no máximo 128 caracteres'),
  role: inviteRoleEnum,
});

export type UserInviteInput = z.infer<typeof userInviteSchema>;
