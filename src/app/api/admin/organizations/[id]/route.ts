import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';

/**
 * GET /api/admin/organizations/:id — Detalhes de uma organização
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            leads: true,
            projects: true,
            tasks: true,
            serviceOrders: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(org);
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao buscar:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/organizations/:id — Atualiza uma organização
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, slug, plan, maxUsers, maxLeads } = body;

    // Verifica se existe
    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    // Se o slug mudou, verifica duplicidade
    if (slug && slug !== existing.slug) {
      const normalizedSlug = slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const slugExists = await prisma.organization.findFirst({
        where: { slug: normalizedSlug, NOT: { id } },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'Já existe uma organização com este slug' },
          { status: 409 }
        );
      }
    }

    // Monta dados para atualizar (só campos enviados)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (slug !== undefined) {
      updateData.slug = slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    if (plan !== undefined) updateData.plan = plan;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (maxLeads !== undefined) updateData.maxLeads = maxLeads;

    const org = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(org);
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao atualizar:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/:id — Remove uma organização
 * ⚠️ CUIDADO: Remove todos os dados vinculados (cascade)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Verifica se existe
    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    // Deleta organização (cascade deleta users, leads, etc.)
    await prisma.organization.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Organização "${existing.name}" removida com sucesso`,
    });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao deletar:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
