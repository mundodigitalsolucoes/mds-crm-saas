// src/app/api/admin/organizations/[id]/route.ts
// API Admin — Detalhe, Atualização e Exclusão de Organização (com syncPlanLimits)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgUpdateSchema } from '@/lib/validations';

/**
 * GET /api/admin/organizations/:id — Detalhes de uma organização com usage
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
          where: { deletedAt: null },
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

    // Retorna com limites e usage lado a lado
    return NextResponse.json({
      ...org,
      limits: {
        maxUsers: org.maxUsers,
        maxLeads: org.maxLeads,
        maxProjects: org.maxProjects,
        maxOs: org.maxOs,
      },
      usage: {
        users: org.users.length,
        leads: org._count.leads,
        projects: org._count.projects,
        tasks: org._count.tasks,
        serviceOrders: org._count.serviceOrders,
      },
    });
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
 * Se syncFromPlan=true E plan mudou, copia limites do novo Plan.
 * Se syncFromPlan=false, usa os valores manuais (customização por org).
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

    // ✅ Validação Zod centralizada
    const parsed = parseBody(adminOrgUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Verifica se existe
    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    // Se o slug mudou, verifica duplicidade
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.organization.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'Já existe uma organização com este slug' },
          { status: 409 }
        );
      }
    }

    // Extrai syncFromPlan antes de enviar pro Prisma (não é coluna do banco)
    const { syncFromPlan, ...updateData } = data;

    // ✅ Se syncFromPlan=true E plan mudou, copia limites do novo plano
    const planChanged = data.plan && data.plan !== existing.plan;

    if (syncFromPlan && planChanged) {
      // Primeiro atualiza campos não-limite (name, slug, planStatus, etc.)
      const { maxUsers, maxLeads, maxProjects, maxOs, ...nonLimitData } = updateData;

      // Atualiza campos não-limite
      if (Object.keys(nonLimitData).length > 0) {
        await prisma.organization.update({
          where: { id },
          data: nonLimitData,
        });
      }

      // Depois sincroniza limites do Plan
      const synced = await syncPlanLimits(id, data.plan!);

      if (synced) {
        return NextResponse.json({
          ...synced,
          _syncedFromPlan: true,
          message: `Limites sincronizados do plano "${data.plan}"`,
        });
      }

      // Se plano não encontrado, faz update normal com os valores manuais
      console.warn(`[ADMIN ORGS] Plano "${data.plan}" não encontrado. Usando valores manuais.`);
    }

    // Update normal (customização manual ou sem sync)
    const org = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...org,
      _syncedFromPlan: false,
    });
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
