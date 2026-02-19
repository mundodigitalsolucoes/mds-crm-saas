// src/types/next-auth.d.ts
// Tipagem estendida do NextAuth para incluir dados multi-tenant, permissões e plano

import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: string;
      permissions: string; // JSON string das permissões
      plan: string; // trial, starter, professional, enterprise
      planStatus: string; // active, cancelled, past_due, trial_expired
      trialEndsAt: string | null; // ISO string ou null
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    organizationId: string;
    role: string;
    permissions: string;
    plan: string;
    planStatus: string;
    trialEndsAt: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    organizationId: string;
    role: string;
    permissions: string;
    plan: string;
    planStatus: string;
    trialEndsAt: string | null;
  }
}
