import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  generateAdminToken,
  setAdminCookie,
  clearAdminCookie,
  verifyAdminToken,
} from '@/lib/admin-auth';

/**
 * POST /api/admin/auth — Login do SuperAdmin
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Validação básica
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca o SuperAdmin no banco
    const admin = await prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Verifica a senha
    // ✅ CORRETO - campo real do banco
const passwordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Gera o JWT
    const token = await generateAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'superadmin',
    });

    // Retorna com cookie httpOnly
    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    });

    response.headers.set('Set-Cookie', setAdminCookie(token));

    return response;
  } catch (error) {
    console.error('[ADMIN AUTH] Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auth — Verifica se o admin está autenticado
 */
export async function GET() {
  try {
    const admin = await verifyAdminToken();

    if (!admin) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error('[ADMIN AUTH] Erro na verificação:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth — Logout do SuperAdmin
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearAdminCookie());
  return response;
}
