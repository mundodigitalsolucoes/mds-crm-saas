// middleware.ts
// Middleware unificado: Auth (NextAuth) + SuperAdmin (JWT) + Plan Status (trial/cancelled)
// Rate limiting é aplicado diretamente nas API routes (Node.js runtime)

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'super-admin-secret-key'
);

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

type SessionValidationPayload = {
  user?: {
    id?: string | null;
  };
  banned?: boolean;
  organizationDeleted?: boolean;
};

function buildLoginRedirect(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/auth/login', req.url));

  for (const cookieName of AUTH_COOKIE_NAMES) {
    response.cookies.set(cookieName, '', { maxAge: 0, path: '/' });
  }

  return response;
}

async function validateSessionState(req: NextRequest) {
  try {
    const sessionUrl = new URL('/api/auth/session', req.url);

    const response = await fetch(sessionUrl, {
      headers: {
        cookie: req.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        valid: false,
        banned: true,
        organizationDeleted: false,
      };
    }

    const data = (await response.json()) as SessionValidationPayload | null;

    return {
      valid: Boolean(data?.user?.id),
      banned: Boolean(data?.banned),
      organizationDeleted: Boolean(data?.organizationDeleted),
    };
  } catch {
    return {
      valid: false,
      banned: true,
      organizationDeleted: false,
    };
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
      await jwtVerify(adminToken, ADMIN_JWT_SECRET);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL('/admin/login', req.url));
      response.cookies.set('admin-token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return buildLoginRedirect(req);
  }

  if (token.banned || token.organizationDeleted) {
    return buildLoginRedirect(req);
  }

  const sessionState = await validateSessionState(req);

  if (!sessionState.valid || sessionState.banned || sessionState.organizationDeleted) {
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
  ],
};