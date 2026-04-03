// src/lib/auth.ts
// Configuração CENTRALIZADA do NextAuth.js
// Single source of truth — usado por route.ts e getServerSession()
// Inclui permissões granulares + dados do plano no JWT e session

import { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

type AuthorizedUserPayload = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: string;
  permissions: string;
  plan: string;
  planStatus: string;
  trialEndsAt: string | null;
};

type SessionWithFlags = Session & {
  banned?: boolean;
  organizationDeleted?: boolean;
  lastChecked?: number | null;
};

export const authOptions: NextAuthOptions = {
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
            deletedAt: true,
            organization: {
              select: {
                plan: true,
                planStatus: true,
                trialEndsAt: true,
                deletedAt: true,
              },
            },
          },
        });

        if (!user || user.deletedAt || user.organization.deletedAt) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
          permissions: user.permissions,
          plan: user.organization.plan,
          planStatus: user.organization.planStatus,
          trialEndsAt: user.organization.trialEndsAt?.toISOString() || null,
        } satisfies AuthorizedUserPayload;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthorizedUserPayload;

        token.id = authUser.id;
        token.organizationId = authUser.organizationId;
        token.role = authUser.role;
        token.permissions = authUser.permissions;
        token.plan = authUser.plan;
        token.planStatus = authUser.planStatus;
        token.trialEndsAt = authUser.trialEndsAt;
      }

      if (token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              role: true,
              permissions: true,
              organizationId: true,
              deletedAt: true,
              organization: {
                select: {
                  plan: true,
                  planStatus: true,
                  trialEndsAt: true,
                  deletedAt: true,
                },
              },
            },
          });

          if (!freshUser || freshUser.deletedAt || freshUser.organization.deletedAt) {
            token.banned = true;
            token.organizationDeleted = Boolean(freshUser?.organization.deletedAt);
            token.lastChecked = Date.now();
            return token;
          }

          token.banned = false;
          token.organizationDeleted = false;
          token.organizationId = freshUser.organizationId;
          token.role = freshUser.role;
          token.permissions = freshUser.permissions;
          token.plan = freshUser.organization.plan;
          token.planStatus = freshUser.organization.planStatus;
          token.trialEndsAt = freshUser.organization.trialEndsAt?.toISOString() || null;
          token.lastChecked = Date.now();
        } catch {
          // Em caso de erro de DB, mantém o token atual
        }
      }

      return token;
    },
    async session({ session, token }) {
      const sessionWithFlags = session as SessionWithFlags;

      if (sessionWithFlags.user) {
        sessionWithFlags.user.id = token.id as string;
        sessionWithFlags.user.organizationId = token.organizationId as string;
        sessionWithFlags.user.role = token.role as string;
        sessionWithFlags.user.permissions = token.permissions as string;
        sessionWithFlags.user.plan = token.plan as string;
        sessionWithFlags.user.planStatus = token.planStatus as string;
        sessionWithFlags.user.trialEndsAt = (token.trialEndsAt as string) || null;
      }

      sessionWithFlags.banned = Boolean(token.banned);
      sessionWithFlags.organizationDeleted = Boolean(token.organizationDeleted);
      sessionWithFlags.lastChecked =
        typeof token.lastChecked === 'number' ? token.lastChecked : null;

      return sessionWithFlags;
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
};