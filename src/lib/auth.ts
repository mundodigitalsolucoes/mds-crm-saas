// src/lib/auth.ts
// Configuração CENTRALIZADA do NextAuth.js
// Single source of truth — usado por route.ts e getServerSession()
// Inclui permissões granulares + dados do plano no JWT e session

import { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { provisionChatwootForOrg } from '@/lib/integrations/chatwoot-provision';

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
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
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
    async jwt({ token, user, account }) {
      if (user && account?.provider === 'google') {
        const email = user.email?.trim().toLowerCase();
        const crmUser = account.providerAccountId ? await prisma.user.findFirst({
          where: { googleIdentity: { googleSub: account.providerAccountId } }, select: {
            id: true, organizationId: true, role: true, permissions: true, deletedAt: true,
            organization: { select: { plan: true, planStatus: true, trialEndsAt: true, deletedAt: true } },
          },
        }) : null;
        if (!crmUser || crmUser.deletedAt || crmUser.organization.deletedAt) {
          token.banned = true;
          return token;
        }
        token.id = crmUser.id;
        token.organizationId = crmUser.organizationId;
        token.role = crmUser.role;
        token.permissions = crmUser.permissions;
        token.plan = crmUser.organization.plan;
        token.planStatus = crmUser.organization.planStatus;
        token.trialEndsAt = crmUser.organization.trialEndsAt?.toISOString() || null;
      } else if (user) {
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
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      try {
        const parsed = new URL(url);

        if (parsed.origin === baseUrl) {
          return url;
        }
      } catch {
        // cai no fallback abaixo
      }

      return `${baseUrl}/dashboard`;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      const email = user.email?.trim().toLowerCase();
      const sub = account.providerAccountId;
      if (!verified || !email || !sub) return false;

      const linked = await prisma.googleIdentity.findUnique({
        where: { googleSub: sub },
        include: { user: { include: { organization: true } } },
      });
      if (linked) return !linked.user.deletedAt && !linked.user.organization.deletedAt;

      const existing = await prisma.user.findUnique({
        where: { email }, include: { organization: true, googleIdentity: true },
      });
      if (existing) {
        if (existing.deletedAt || existing.organization.deletedAt || existing.googleIdentity) return false;
        // Verified Google email may link only an existing account without another Google identity.
        try {
          await prisma.googleIdentity.create({ data: { googleSub: sub, userId: existing.id } });
          return true;
        } catch { return false; }
      }

      // New users must have explicitly accepted terms and supplied an organization before OAuth.
      const intent = (await cookies()).get('mds-google-signup')?.value;
      if (!intent || !process.env.NEXTAUTH_SECRET) return '/auth/signup?google=required';
      let companyName: string;
      let consentIp: string;
      try {
        const { payload } = await jwtVerify(intent, new TextEncoder().encode(process.env.NEXTAUTH_SECRET), {
          audience: 'mds-google-signup', issuer: 'mds-crm',
        });
        if (payload.consent !== true || typeof payload.companyName !== 'string' ||
          payload.companyName.trim().length === 0 || payload.companyName.length > 255) return false;
        companyName = payload.companyName.trim();
        consentIp = typeof payload.consentIp === 'string' ? payload.consentIp : 'unknown';
      } catch { return '/auth/signup?google=expired'; }

      const base = companyName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'empresa';
      const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
      const randomPassword = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10);
      try {
        const result = await prisma.$transaction(async (tx) => {
          const organization = await tx.organization.create({
            data: { name: companyName, slug, plan: 'trial', planStatus: 'active',
              trialEndsAt: new Date(Date.now() + 14 * 86400000) },
          });
          const crmUser = await tx.user.create({
            data: { email, name: user.name?.trim() || email, passwordHash: randomPassword,
              organizationId: organization.id, role: 'owner', emailVerified: new Date(),
              consentAt: new Date(), consentIp },
          });
          await tx.googleIdentity.create({ data: { googleSub: sub, userId: crmUser.id } });
          return { organization, crmUser };
        });
        void provisionChatwootForOrg({
          organizationId: result.organization.id, orgName: result.organization.name,
          orgSlug: result.organization.slug, ownerUserId: result.crmUser.id,
          ownerName: result.crmUser.name, ownerEmail: result.crmUser.email,
          ownerPassword: `Tmp@${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}!Z`,
        }).then((outcome) => {
          if (!outcome.success) console.warn('[GOOGLE SIGNUP] Chatwoot provisioning failed');
        }).catch(() => console.error('[GOOGLE SIGNUP] Chatwoot provisioning error'));
        return true;
      } catch {
        // Concurrent signup or existing email/sub must never create a second trial.
        return false;
      }
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};