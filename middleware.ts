// middleware.ts
// Middleware unificado: Auth (NextAuth) + SuperAdmin (JWT) + Plan Status (trial/cancelled)
// Rate limiting é aplicado diretamente nas API routes (Node.js runtime)
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'super-admin-secret-key'
);

// Rotas que o usuário pode acessar mesmo com plano inativo
const PLAN_EXEMPT_ROUTES = [
  '/settings',
  '/api/auth',
  '/auth',
  '/api/export-data',
  '/api/delete-account',
];

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
      const response = NextResponse.redirect(new URL('/admin/login', req.url));
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

  // ═══════════════════════════════════════
  // 📋 VERIFICAÇÃO DE STATUS DO PLANO
  // ═══════════════════════════════════════

  // Verifica se a rota é isenta (settings, auth, LGPD)
  const isExempt = PLAN_EXEMPT_ROUTES.some((route) => pathname.startsWith(route));

  if (!isExempt) {
    const planStatus = token.planStatus as string | undefined;
    const plan = token.plan as string | undefined;
    const trialEndsAt = token.trialEndsAt as string | undefined;

    let planBlocked = false;

    // Plano cancelado ou pagamento pendente
    if (planStatus === 'cancelled' || planStatus === 'past_due' || planStatus === 'trial_expired') {
      planBlocked = true;
    }

    // Trial expirado (verificação por data no token — sem hit no banco)
    if (plan === 'trial' && trialEndsAt) {
      const now = new Date();
      if (now > new Date(trialEndsAt)) {
        planBlocked = true;
      }
    }

    if (planBlocked) {
      // APIs retornam 403 JSON
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            error: 'Plano inativo',
            detail: 'Seu plano está inativo. Acesse as configurações para regularizar.',
            code: 'PLAN_INACTIVE',
          },
          { status: 403 }
        );
      }

      // Páginas redirecionam para settings
      return NextResponse.redirect(new URL('/settings?plan=inactive', req.url));
    }
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
    // APIs do SuperAdmin
    '/api/admin/:path*',
  ],
};
