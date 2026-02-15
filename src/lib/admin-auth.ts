import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

/**
 * Helper de autenticação do SuperAdmin
 * Usa JWT separado do NextAuth, salvo em cookie httpOnly
 */

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'super-admin-secret-key'
);

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
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(ADMIN_JWT_SECRET);
}

/**
 * Verifica e decodifica o token do SuperAdmin
 * Retorna o payload ou null se inválido/expirado
 */
export async function verifyAdminToken(): Promise<AdminTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET);
    return payload as unknown as AdminTokenPayload;
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
