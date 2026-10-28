// src/app/api/usage/route.ts
// API de Usage — Retorna limites e uso atual da organização do usuário logado
// Usado pelo frontend para barras de progresso, banners de upgrade, etc.
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/checkPermission';
import { getOrganizationUsage } from '@/lib/checkLimits';

export async function GET() {
  try {
    const authentication = await checkAuth();
    if (!authentication.authenticated || !authentication.session) return authentication.errorResponse!;
    const session = authentication.session;

    const usage = await getOrganizationUsage(session.user.organizationId);

    if (!usage) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(usage);
  } catch (error) {
    console.error('[API USAGE] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
