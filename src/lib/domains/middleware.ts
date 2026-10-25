import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveRequestDomain, sessionMatchesDomain } from './request';

export async function domainIngress(req: NextRequest): Promise<NextResponse | null> {
  let context;
  try { context = await resolveRequestDomain(req.headers); } catch { return new NextResponse(null, { status: 503 }); }
  if (context.kind === 'denied') return new NextResponse(null, { status: 421 });
  let path: string;
  try {
    path = decodeURIComponent(req.nextUrl.pathname);
    if (/[\\%\u0000]/.test(path)) return new NextResponse(null, { status: 400 });
    path = new URL(path, 'https://canonical.invalid').pathname.toLowerCase();
  } catch { return new NextResponse(null, { status: 400 }); }
  if (context.kind === 'custom') {
    if (path === '/.well-known/mds-crm-domain-check') return null;
    if (!context.active) return new NextResponse(null, { status: 421 });
    if (path === '/_next/image') {
      const asset = req.nextUrl.searchParams.get('url') || '';
      if (!/^\/images\/[a-zA-Z0-9_./-]+$/.test(asset) || asset.includes('..')) return new NextResponse(null, { status: 403 });
    }
    // Administration, signup and external callbacks stay on the canonical MDS host.
    if (/^\/(admin(?:\/|$)|api\/admin(?:\/|$)|api\/auth\/signup(?:\/|$)|auth\/signup(?:\/|$)|api\/webhooks(?:\/|$)|api\/public(?:\/|$)|public(?:\/|$)|uploads(?:\/|$)|widget(?:\/|$))/.test(path)
      || /^\/api\/.*\/(callback|webhook)(?:\/|$)/.test(path) && !path.startsWith('/api/auth/callback/')) return new NextResponse(null, { status: 403 });
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: true });
  if (token && !sessionMatchesDomain(token, context) && !path.startsWith('/auth/') && !path.startsWith('/api/auth/')) {
    return new NextResponse(null, { status: 401 });
  }
  return null;
}
