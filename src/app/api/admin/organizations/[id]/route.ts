// src/app/api/admin/organizations/[id]/route.ts
// API Admin — Detalhe, Atualização e Exclusão de Organização (com syncPlanLimits)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgUpdateSchema } from '@/lib/validations';
import { deleteChatwootAccount } from '@/lib/integrations/chatwoot-cleanup';
import { disconnectInstance } from '@/lib/integrations/evolutionClient';

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

    const parsed = parseBody(adminOrgUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

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

    const { syncFromPlan, ...updateData } = data;
    const planChanged = data.plan && data.plan !== existing.plan;

    if (syncFromPlan && planChanged) {
      const { maxUsers, maxLeads, maxProjects, maxOs, ...nonLimitData } = updateData;

      if (Object.keys(nonLimitData).length > 0) {
        await prisma.organization.update({
          where: { id },
          data: nonLimitData,
        });
      }

      const synced = await syncPlanLimits(id, data.plan!);

      if (synced) {
        return NextResponse.json({
          ...synced,
          _syncedFromPlan: true,
          message: `Limites sincronizados do plano "${data.plan}"`,
        });
      }

      console.warn(`[ADMIN ORGS] Plano "${data.plan}" não encontrado. Usando valores manuais.`);
    }

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
 * DELETE /api/admin/organizations/:id — Remove uma organização + limpeza no Chatwoot + Evolution
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

    // 1. Busca org e dados do Chatwoot antes de deletar
    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
        connectedAccounts: {
          where: { provider: 'chatwoot' },
          select: { data: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    // 2. Tenta deletar Account no Chatwoot (cascade deleta users/inboxes)
    try {
      const cwAccount = existing.connectedAccounts?.[0];
      if (cwAccount?.data) {
        const cwData = JSON.parse(cwAccount.data) as { chatwootAccountId?: number };
        if (cwData.chatwootAccountId) {
          await deleteChatwootAccount(cwData.chatwootAccountId);
        }
      } else if (existing.chatwootAccountId) {
        await deleteChatwootAccount(existing.chatwootAccountId);
      }
    } catch (cwErr) {
      console.warn('[ADMIN ORGS] Aviso: falha ao deletar no Chatwoot:', cwErr);
    }

    // 2b. Tenta deletar instância na Evolution (logout + delete)
    try {
      const waAccount = await prisma.connectedAccount.findUnique({
        where: { provider_organizationId: { provider: 'whatsapp', organizationId: id } },
        select: { data: true, isActive: true },
      });
      if (waAccount?.data) {
        const waData = JSON.parse(waAccount.data) as { instanceName?: string };
        if (waData.instanceName) {
          await disconnectInstance(waData.instanceName);
          console.log('[ADMIN ORGS] Evolution instance deletada:', waData.instanceName);
        }
      }
    } catch (evoErr) {
      console.warn('[ADMIN ORGS] Aviso: falha ao deletar na Evolution:', evoErr);
    }

    // 3. Deleta organização do CRM (cascade deleta users, leads, etc.)
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