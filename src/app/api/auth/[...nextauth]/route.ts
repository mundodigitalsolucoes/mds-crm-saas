// src/app/api/auth/[...nextauth]/route.ts
// NextAuth handler com rate limiting no login (proteção brute-force)
// Usa authOptions centralizado de @/lib/auth (single source of truth)

import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const authHandler = NextAuth(authOptions);
async function handlerFor(req: NextRequest) {
  if (process.env.CRM_CUSTOM_DOMAINS_ENABLED !== 'true') return authHandler;
  const { resolveRequestDomain } = await import('@/lib/domains/request');
  const context = await resolveRequestDomain(req.headers);
  if (context.kind === 'denied' || context.kind === 'custom' && !context.active) return null;
  const origin = context.origin;
  return NextAuth({ ...authOptions, callbacks: { ...authOptions.callbacks,
    async redirect({ url }) {
      try { const target = new URL(url, origin); return target.origin === origin ? target.href : origin + '/dashboard'; }
      catch { return origin + '/dashboard'; }
    },
  } });
}
type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

// ============================================
// HANDLERS COM RATE LIMITING
// ============================================

/**
 * GET — Usado pelo NextAuth para CSRF token, session, providers.
 * Sem rate limit restritivo (não é tentativa de login).
 */
export async function GET(req: NextRequest, context: AuthRouteContext) {
  const handler = await handlerFor(req);
  if (!handler) return new NextResponse(null, { status: 421 });
  return handler(req, context);
}

/**
 * POST — Usado para login (callback/credentials) e signout.
 * Aplica rate limit de 5 req/min por IP (proteção brute-force).
 */
export async function POST(req: NextRequest, context: AuthRouteContext) {
  // Rate limit apenas no POST (tentativas de login)
  const blocked = applyRateLimit(req, 'auth', AUTH_RATE_LIMIT);
  if (blocked) return blocked;

  const handler = await handlerFor(req);
  if (!handler) return new NextResponse(null, { status: 421 });
  return handler(req, context);
}
