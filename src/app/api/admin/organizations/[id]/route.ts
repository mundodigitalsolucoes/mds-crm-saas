// src/app/api/admin/organizations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgUpdateSchema } from '@/lib/validations';
import {
  invalidateChatwootUserSessions,
} from '@/lib/integrations/chatwoot-cleanup';
import { disconnectInstance } from '@/lib/integrations/evolutionClient';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { leads: true, projects: true, tasks: true, serviceOrders: true },
        },
      },
    });

    if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });

    return NextResponse.json({
      ...org,
      limits: { maxUsers: org.maxUsers, maxLeads: org.maxLeads, maxProjects: org.maxProjects, maxOs: org.maxOs },
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
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const body   = await req.json();

    const parsed = parseBody(adminOrgUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });

    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.organization.findFirst({ where: { slug: data.slug, NOT: { id } } });
      if (slugExists) return NextResponse.json({ error: 'Já existe uma organização com este slug' }, { status: 409 });
    }

    const { syncFromPlan, ...updateData } = data;
    const planChanged = data.plan && data.plan !== existing.plan;

    if (syncFromPlan && planChanged) {
      const { maxUsers, maxLeads, maxProjects, maxOs, ...nonLimitData } = updateData;
      if (Object.keys(nonLimitData).length > 0) {
        await prisma.organization.update({ where: { id }, data: nonLimitData });
      }
      const synced = await syncPlanLimits(id, data.plan!);
      if (synced) {
        return NextResponse.json({ ...synced, _syncedFromPlan: true, message: `Limites sincronizados do plano "${data.plan}"` });
      }
      console.warn(`[ADMIN ORGS] Plano "${data.plan}" não encontrado. Usando valores manuais.`);
    }

    const org = await prisma.organization.update({ where: { id }, data: updateData });
    return NextResponse.json({ ...org, _syncedFromPlan: false });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao atualizar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/organizations/:id
 * SOFT DELETE — marca deletedAt em vez de remover do banco.
 * Invalida sessões no Chatwoot e desconecta WhatsApp.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const warnings: string[] = [];

    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
        connectedAccounts: {
          where: { provider: 'chatwoot' },
          select: { data: true },
        },
      },
    });

    if (!existing) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Organização já está inativa' }, { status: 409 });

    // Resolve chatwootAccountId
    let chatwootAccountId: number | null = existing.chatwootAccountId ?? null;
    if (!chatwootAccountId && existing.connectedAccounts?.[0]?.data) {
      try {
        const cwData = JSON.parse(existing.connectedAccounts[0].data) as { chatwootAccountId?: number };
        chatwootAccountId = cwData.chatwootAccountId ?? null;
      } catch {}
    }

    // ── 1. Invalidar sessões Chatwoot via SQL ─────────────────────────────
    if (chatwootAccountId) {
      const { blocked, errors } = await invalidateChatwootUserSessions(chatwootAccountId);
      if (errors.length > 0) {
        warnings.push(`Falha ao invalidar sessões Chatwoot: ${errors.join(', ')}`);
      } else {
        console.info(`[ADMIN ORGS] Sessões Chatwoot invalidadas: ${blocked.join(', ')}`);
      }
    }

    // ── 2. Desconectar WhatsApp ───────────────────────────────────────────
    try {
      const waAccount = await prisma.connectedAccount.findUnique({
        where: { provider_organizationId: { provider: 'whatsapp', organizationId: id } },
        select: { data: true },
      });
      if (waAccount?.data) {
        const waData = JSON.parse(waAccount.data) as { instanceName?: string };
        if (waData.instanceName) {
          await disconnectInstance(waData.instanceName);
          console.info('[ADMIN ORGS] Evolution instance desconectada:', waData.instanceName);
        }
      }
    } catch (evoErr) {
      const msg = evoErr instanceof Error ? evoErr.message : String(evoErr);
      warnings.push(`Falha ao desconectar WhatsApp: ${msg}`);
    }

    // ── 3. Soft delete — marca deletedAt e desativa plano ────────────────
    await prisma.organization.update({
      where: { id },
      data: {
        deletedAt:  new Date(),
        planStatus: 'inactive',
      },
    });

    console.info(`[ADMIN ORGS] ✅ Org "${existing.name}" marcada como inativa (soft delete)`);

    return NextResponse.json({
      success: true,
      message: `Organização "${existing.name}" desativada com sucesso`,
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao desativar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}