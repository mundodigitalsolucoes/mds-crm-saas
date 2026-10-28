// src/app/api/organizations/route.ts
// GET: carrega dados da organização atual
// PATCH: identidade comercial reservada ao Super Admin (endpoint próprio).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody } from '@/lib/validations';
import { resolveCommercialEntitlements } from '@/lib/entitlements/resolver';
import { brandingUpdateSchema } from '@/lib/validations/branding';

// ── GET /api/organizations ────────────────────────────────────────────────────
export async function GET() {
  try {
    const { allowed, session, errorResponse } = await checkPermission('settings', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id:             true,
        name:           true,
        slug:           true,
        logo:           true,
        favicon:        true,
        primaryColor:   true,
        secondaryColor: true,
        features:       true,
        plan:           true,
        planStatus:     true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    const { features, ...publicOrg } = org;
    return NextResponse.json({ ...publicOrg, whiteLabelActive: resolveCommercialEntitlements({ id: org.id, plan: org.plan, features }).capabilities.includes('white_label') });
  } catch (error) {
    console.error('Erro ao buscar organização:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ── PATCH /api/organizations ──────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    // Apenas owner/admin podem alterar branding
    const { allowed, session, errorResponse } = await checkPermission('settings', 'edit');
    if (!allowed) return errorResponse!;

    const role = session!.user.role;
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas proprietários e administradores podem alterar o branding' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(brandingUpdateSchema, body);
    if (!parsed.success) return parsed.response;

    // Este endpoint só aceita identidade visual. Configurações operacionais
    // continuam nos respectivos handlers; a governança comercial pertence à MDS.
    return NextResponse.json({ error: 'A identidade visual é administrada pela MDS' }, { status: 403 });

  } catch (error) {
    console.error('Erro ao atualizar organização:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
