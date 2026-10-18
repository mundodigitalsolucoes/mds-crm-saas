import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { applyRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const schema = z.object({
  companyName: z.string().trim().min(1).max(255),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const blocked = applyRateLimit(request, 'google-signup-intent', AUTH_RATE_LIMIT);
  if (blocked) return blocked;
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Cadastro Google indisponível no momento.' }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Informe a empresa e aceite os termos.' }, { status: 400 });
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  const forwarded = request.headers.get('x-forwarded-for');
  const consentIp = (forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 100);
  const token = await new SignJWT({ companyName: parsed.data.companyName, consentIp, consent: true })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m')
    .setAudience('mds-google-signup').setIssuer('mds-crm').sign(secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('mds-google-signup', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 600,
  });
  return response;
}
