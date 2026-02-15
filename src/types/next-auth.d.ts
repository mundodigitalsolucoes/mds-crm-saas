// src/types/next-auth.d.ts
// Tipagem estendida do NextAuth para incluir dados multi-tenant e permissões

import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: string;
      permissions: string; // JSON string das permissões
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    organizationId: string;
    role: string;
    permissions: string; // JSON string das permissões
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    organizationId: string;
    role: string;
    permissions: string; // JSON string das permissões
  }
}
