// middleware.ts
// Middleware unificado: Auth (NextAuth) + SuperAdmin (JWT) + Plan Status (trial/cancelled)
// Rate limiting é aplicado diretamente nas API routes (Node.js runtime)

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.trim().length < 32 || secret === 'super-admin-secret-key') return null;
  return new TextEncoder().encode(secret);
}

const PLAN_EXEMPT_ROUTES = [
  '/settings',
  '/api/auth',
  '/auth',
  '/api/export-data',
  '/api/delete-account',
];

const AUTH_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
];

function buildLoginRedirect(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/auth/login', req.url));

  for (const cookieName of AUTH_COOKIE_NAMES) {
    response.cookies.set(cookieName, '', { maxAge: 0, path: '/' });
  }

  return response;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (process.env.CRM_CUSTOM_DOMAINS_ENABLED !== 'true') {
    const authority = req.headers.get('host');
    if (!authority) return new NextResponse(null, { status: 421 });
    if (authority) {
      try {
        if (/[\s\\/@?#%,]/.test(authority)) return new NextResponse(null, { status: 421 });
        const primary = new URL(process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br');
        const incoming = new URL(primary.protocol + '//' + authority);
        if (incoming.hostname.replace(/\.$/, '').toLowerCase() !== primary.hostname.toLowerCase() || incoming.port !== primary.port) return new NextResponse(null, { status: 421 });
      } catch { return new NextResponse(null, { status: 421 }); }
    }
  }
  if (process.env.CRM_CUSTOM_DOMAINS_ENABLED === 'true') {
    const { domainIngress } = await import('./src/lib/domains/middleware');
    const denied = await domainIngress(req);
    if (denied) return denied;
  }
  // The extra matcher below validates hostnames, not operational permissions.
  // Preserve exactly which paths the existing middleware authenticated before.
  const legacyProtected = config.matcher.slice(0, -1).some(pattern => {
    const prefix = pattern.replace('/:path*', '');
    return pathname === prefix || pathname.startsWith(prefix + '/');
  });
  if (!legacyProtected) return NextResponse.next();

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (
      pathname === '/admin/login' ||
      pathname.startsWith('/api/admin/auth')
    ) {
      return NextResponse.next();
    }

    const adminToken = req.cookies.get('admin-token')?.value;

    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    try {
      const secret = getAdminJwtSecret();
      if (!secret) throw new Error('Admin signing secret not configured');
      const { payload } = await jwtVerify(adminToken, secret, { algorithms: ['HS256'] });
      if (payload.role !== 'superadmin' || typeof payload.id !== 'string' || !payload.id) {
        throw new Error('Invalid admin identity');
      }
      // Middleware is only a preliminary filter; API authorization rechecks the DB.
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL('/admin/login', req.url));
      response.cookies.set('admin-token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, ...(process.env.CRM_CUSTOM_DOMAINS_ENABLED === 'true' ? { secureCookie: true } : {}) });

  if (!token) {
    return buildLoginRedirect(req);
  }

  if (token.banned || token.organizationDeleted) {
    return buildLoginRedirect(req);
  }

  const isExempt = PLAN_EXEMPT_ROUTES.some((route) => pathname.startsWith(route));

  if (!isExempt) {
    const planStatus = token.planStatus as string | undefined;
    const plan = token.plan as string | undefined;
    const trialEndsAt = token.trialEndsAt as string | undefined;

    let planBlocked = false;

    if (planStatus === 'cancelled' || planStatus === 'past_due' || planStatus === 'trial_expired') {
      planBlocked = true;
    }

    if (plan === 'trial' && trialEndsAt) {
      const now = new Date();
      if (now > new Date(trialEndsAt)) {
        planBlocked = true;
      }
    }

    if (planBlocked) {
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

      return NextResponse.redirect(new URL('/settings?plan=inactive', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/dashboard/:path*',
    '/leads/:path*',
    '/kanban/:path*',
    '/projetos/:path*',
    '/projects/:path*',
    '/os/:path*',
    '/tarefas/:path*',
    '/tasks/:path*',
    '/agenda/:path*',
    '/atendimento/:path*',
    '/relatorios/:path*',
    '/reports/:path*',
    '/configuracoes/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api/admin/:path*',
    '/((?!_next/static).*)',
  ],
};