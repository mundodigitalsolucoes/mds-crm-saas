// src/app/api/organizations/route.ts
// GET: carrega dados da organização atual
// PATCH: atualiza branding (owner/admin apenas)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody } from '@/lib/validations';
import { z } from 'zod';

// ── Schema de validação do branding ──────────────────────────────────────────
const brandingUpdateSchema = z.object({
  name:           z.string().min(2).max(100).optional(),
  logo:           z.string().url('URL inválida').optional().nullable(),
  favicon:        z.string().url('URL inválida').optional().nullable(),
  primaryColor:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida (ex: #6366f1)').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida (ex: #4f46e5)').optional(),
});

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
        plan:           true,
        planStatus:     true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    return NextResponse.json(org);
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

    const organizationId = session!.user.organizationId;
    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(brandingUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Montar apenas os campos enviados (patch parcial)
    const updateData: Record<string, any> = {};
    if (data.name           !== undefined) updateData.name           = data.name;
    if (data.logo           !== undefined) updateData.logo           = data.logo;
    if (data.favicon        !== undefined) updateData.favicon        = data.favicon;
    if (data.primaryColor   !== undefined) updateData.primaryColor   = data.primaryColor;
    if (data.secondaryColor !== undefined) updateData.secondaryColor = data.secondaryColor;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      select: {
        id:             true,
        name:           true,
        slug:           true,
        logo:           true,
        favicon:        true,
        primaryColor:   true,
        secondaryColor: true,
      },
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        entityType:  'organization',
        entityId:    organizationId,
        action:      'updated',
        description: 'Configurações de branding atualizadas',
        userId:      session!.user.id,
      },
    });

    return NextResponse.json(org);
  } catch (error) {
    console.error('Erro ao atualizar organização:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
