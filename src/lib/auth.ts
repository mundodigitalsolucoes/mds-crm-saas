// src/lib/auth.ts
// Configuração CENTRALIZADA do NextAuth.js
// Single source of truth — usado por route.ts e getServerSession()
// Inclui permissões granulares no JWT e session

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
          },
        });

        // Usuário não existe ou foi soft-deleted (LGPD)
        if (!user || user.deletedAt) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
          permissions: user.permissions,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      // ─── Login inicial: gravar dados do user no token ───
      if (user) {
        token.id = user.id;
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
      }

      // ─── Session update: recarregar permissões ───
      // Cenário 1: Client chamou update() com dados (ex: após admin salvar)
      // Cenário 2: Client chamou update() sem dados → busca do banco
      if (trigger === 'update') {
        if (updateData && ('permissions' in updateData || 'role' in updateData)) {
          // Client enviou dados frescos
          if ('permissions' in updateData) {
            token.permissions = updateData.permissions;
          }
          if ('role' in updateData) {
            token.role = updateData.role;
          }
        } else {
          // Busca do banco (fallback seguro)
          try {
            const freshUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, permissions: true },
            });
            if (freshUser) {
              token.role = freshUser.role;
              token.permissions = freshUser.permissions;
            }
          } catch (error) {
            console.error('[AUTH] Erro ao recarregar permissões:', error);
          }
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
