// src/app/api/auth/[...nextauth]/route.ts
// NextAuth handler com rate limiting no login (proteção brute-force)
// Usa authOptions centralizado de @/lib/auth (single source of truth)

import { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const authHandler = NextAuth(authOptions);

// ============================================
// HANDLERS COM RATE LIMITING
// ============================================

/**
 * GET — Usado pelo NextAuth para CSRF token, session, providers.
 * Sem rate limit restritivo (não é tentativa de login).
 */
export async function GET(req: NextRequest, context: any) {
  return authHandler(req as any, context);
}

/**
 * POST — Usado para login (callback/credentials) e signout.
 * Aplica rate limit de 5 req/min por IP (proteção brute-force).
 */
export async function POST(req: NextRequest, context: any) {
  // Rate limit apenas no POST (tentativas de login)
  const blocked = applyRateLimit(req, 'auth', AUTH_RATE_LIMIT);
  if (blocked) return blocked;

  return authHandler(req as any, context);
}
