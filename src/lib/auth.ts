// src/lib/auth.ts
// Configuração CENTRALIZADA do NextAuth.js
// Single source of truth — usado por route.ts e getServerSession()
// Inclui permissões granulares + dados do plano no JWT e session

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
        token.plan = (user as any).plan;
        token.planStatus = (user as any).planStatus;
        token.trialEndsAt = (user as any).trialEndsAt;
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
      if (session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string;
        session.user.role = token.role as string;
        session.user.permissions = token.permissions as string;
        session.user.plan = token.plan as string;
        session.user.planStatus = token.planStatus as string;
        session.user.trialEndsAt = (token.trialEndsAt as string) || null;
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
};