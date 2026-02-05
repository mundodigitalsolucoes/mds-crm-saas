import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
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
          },
        });

        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // nunca retorne passwordHash
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      // garante que session.user existe
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).role = token.role;
      }
      return session;
    },
    // ✅ NOVOS CALLBACKS DE REDIRECT
    async redirect({ url, baseUrl }) {
      // Se a URL já contém /dashboard, manter
      if (url.startsWith('/dashboard')) {
        return `${baseUrl}${url}`;
      }
      
      // Sempre redirecionar para dashboard após login
      return `${baseUrl}/dashboard`;
    },
    async signIn({ user, account, profile, email, credentials }) {
      // Sempre permitir login se chegou até aqui
      return true;
    },
  },
  pages: {
    signIn: '/auth/login', // Página customizada de login
  },
});

export { handler as GET, handler as POST };
