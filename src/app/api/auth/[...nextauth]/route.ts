// src/app/api/auth/[...nextauth]/route.ts
// NextAuth handler com rate limiting no login (proteção brute-force)
import { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { applyRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const authHandler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            organizationId: true,
            role: true,
            permissions: true,
          },
        });

        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
          permissions: user.permissions,
        } as any;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = (user as any).id;
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
      }

      // Recarrega permissões quando session é atualizada (sem precisar relogar)
      if (trigger === 'update' && token.id) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, permissions: true },
        });
        if (freshUser) {
          token.role = freshUser.role;
          token.permissions = freshUser.permissions;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/dashboard')) {
        return `${baseUrl}${url}`;
      }
      return `${baseUrl}/dashboard`;
    },
    async signIn() {
      return true;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

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
