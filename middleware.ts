import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

/**
 * Middleware unificado
 * - Rotas /admin/* → protege com JWT do SuperAdmin (cookie admin-token)
 * - Rotas do CRM → protege com NextAuth (session token)
 */

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'super-admin-secret-key'
);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ═══════════════════════════════════════
  // 🔒 ROTAS DO SUPER ADMIN (/admin/*)
  // ═══════════════════════════════════════
  if (pathname.startsWith('/admin')) {
    // Libera a página de login e a API de auth do admin
    if (
      pathname === '/admin/login' ||
      pathname.startsWith('/api/admin/auth')
    ) {
      return NextResponse.next();
    }

    // Verifica o cookie admin-token
    const adminToken = req.cookies.get('admin-token')?.value;

    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    try {
      await jwtVerify(adminToken, ADMIN_JWT_SECRET);
      return NextResponse.next();
    } catch {
      // Token inválido ou expirado → redireciona pro login
      const response = NextResponse.redirect(new URL('/admin/login', req.url));
      // Limpa o cookie inválido
      response.cookies.set('admin-token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // ═══════════════════════════════════════
  // 🔒 ROTAS DO CRM (NextAuth)
  // ═══════════════════════════════════════
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Rotas do CRM (NextAuth)
    '/dashboard/:path*',
    '/leads/:path*',
    '/kanban/:path*',
    '/projetos/:path*',
    '/projects/:path*',
    '/os/:path*',
    '/tarefas/:path*',
    '/tasks/:path*',
    '/agenda/:path*',
    '/relatorios/:path*',
    '/reports/:path*',
    '/configuracoes/:path*',
    '/settings/:path*',
    // Rotas do SuperAdmin (JWT próprio)
    '/admin/:path*',
    // APIs do SuperAdmin (exceto auth, tratado dentro do middleware)
    '/api/admin/:path*',
  ],
};
