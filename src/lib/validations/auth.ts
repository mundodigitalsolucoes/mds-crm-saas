// src/lib/validations/auth.ts
// Schemas Zod para APIs de Autenticação — MDS CRM
import { z } from 'zod';

// ============================================
// SIGNUP — POST /api/auth/signup
// ============================================

export const signupSchema = z.object({
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
  companyName: z
    .string({ required_error: 'Nome da empresa é obrigatório' })
    .min(1, 'Nome da empresa é obrigatório')
    .max(255, 'Nome da empresa deve ter no máximo 255 caracteres')
    .transform((v) => v.trim()),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(8, 'A senha deve ter no mínimo 8 caracteres')
    .max(128, 'A senha deve ter no máximo 128 caracteres'),
  consent: z
    .literal(true, {
      errorMap: () => ({ message: 'É necessário aceitar a Política de Privacidade e os Termos de Uso' }),
    }),
});

export type SignupInput = z.infer<typeof signupSchema>;

// ============================================
// FORGOT PASSWORD — POST /api/auth/forgot-password
// ============================================

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255)
    .transform((v) => v.trim().toLowerCase()),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ============================================
// RESET PASSWORD — POST /api/auth/reset-password
// ============================================

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Token é obrigatório' })
    .min(1, 'Token é obrigatório'),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(6, 'A senha deve ter no mínimo 6 caracteres')
    .max(128, 'A senha deve ter no máximo 128 caracteres'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
