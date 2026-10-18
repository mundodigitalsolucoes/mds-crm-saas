import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Helper de autenticação do SuperAdmin
 * Usa JWT separado do NextAuth, salvo em cookie httpOnly
 */

function adminJwtSecret(): Uint8Array | null {
  const secret = process.env.ADMIN_JWT_SECRET;
  // Do not silently fall back to a tenant secret or a known development key.
  if (!secret || secret.trim().length < 32 || secret === 'super-admin-secret-key') return null;
  return new TextEncoder().encode(secret);
}

const COOKIE_NAME = 'admin-token';
const EXPIRATION = '8h'; // Token expira em 8 horas

// Tipagem do payload do token
export interface AdminTokenPayload {
  id: string;
  email: string;
  name: string;
  role: 'superadmin';
}

/**
 * Gera um JWT para o SuperAdmin
 */
export async function generateAdminToken(payload: AdminTokenPayload): Promise<string> {
  const secret = adminJwtSecret();
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not securely configured');
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secret);
}

/**
 * Verifica e decodifica o token do SuperAdmin
 * Retorna o payload ou null se inválido/expirado
 */
export async function verifyAdminToken(): Promise<AdminTokenPayload | null> {
  try {
    const secret = adminJwtSecret();
    if (!secret) return null;
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.role !== 'superadmin' || typeof payload.id !== 'string' || !payload.id) return null;
    const admin = await prisma.superAdmin.findUnique({
      where: { id: payload.id }, select: { id: true, email: true, name: true },
    });
    if (!admin || admin.email !== payload.email) return null;
    return { ...admin, role: 'superadmin' };
  } catch {
    return null;
  }
}

/**
 * Define o cookie do admin token na response
 */
export function setAdminCookie(token: string): string {
  // Retorna o header Set-Cookie formatado
  const maxAge = 8 * 60 * 60; // 8 horas em segundos
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

/**
 * Retorna o header Set-Cookie para limpar o token (logout)
 */
export function clearAdminCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
