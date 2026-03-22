// src/app/api/admin/organizations/[id]/route.ts
// API Admin — Detalhe, Atualização e Exclusão de Organização (com syncPlanLimits)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgUpdateSchema } from '@/lib/validations';
import {
  invalidateChatwootUserSessions,
  deleteChatwootAccount,
  purgeOrphanChatwootAccount,
} from '@/lib/integrations/chatwoot-cleanup';
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
 * DELETE /api/admin/organizations/:id
 * Ordem de operações:
 *   1. Invalidar sessões Chatwoot via SQL (contenção garantida)
 *   2. Tentar deletar Account Chatwoot via API
 *   3. Se API falhar → purgar via SQL direto
 *   4. Desconectar instância Evolution
 *   5. Deletar organização do CRM (cascade)
 *   6. Retornar warnings se alguma limpeza falhou
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
    const warnings: string[] = [];

    // Busca org antes de deletar
    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
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

    // Resolve chatwootAccountId
    let chatwootAccountId: number | null = existing.chatwootAccountId ?? null;
    if (!chatwootAccountId && existing.connectedAccounts?.[0]?.data) {
      try {
        const cwData = JSON.parse(existing.connectedAccounts[0].data) as { chatwootAccountId?: number };
        chatwootAccountId = cwData.chatwootAccountId ?? null;
      } catch {}
    }

    // ── PASSO 1: Invalidar sessões via SQL (contenção garantida) ──────────────
    if (chatwootAccountId) {
      const { blocked, errors } = await invalidateChatwootUserSessions(chatwootAccountId);

      if (errors.length > 0) {
        warnings.push(`Falha ao invalidar sessões Chatwoot: ${errors.join(', ')}`);
      } else {
        console.info(`[ADMIN ORGS] Sessões invalidadas: ${blocked.join(', ')}`);
      }
    }

    // ── PASSO 2: Deletar Account via API ──────────────────────────────────────
    if (chatwootAccountId) {
      const apiDeleted = await deleteChatwootAccount(chatwootAccountId);

      // ── PASSO 3: Se API falhou → purgar via SQL ───────────────────────────
      if (!apiDeleted) {
        console.warn(`[ADMIN ORGS] API delete falhou — tentando purga SQL para account #${chatwootAccountId}`);
        const sqlPurged = await purgeOrphanChatwootAccount(chatwootAccountId);

        if (!sqlPurged) {
          warnings.push(
            `Account Chatwoot #${chatwootAccountId} não foi deletada. ` +
            `Sessões já foram invalidadas — usuários não conseguem mais logar.`
          );
        }
      }
    }

    // ── PASSO 4: Desconectar instância Evolution ──────────────────────────────
    try {
      const waAccount = await prisma.connectedAccount.findUnique({
        where: { provider_organizationId: { provider: 'whatsapp', organizationId: id } },
        select: { data: true },
      });
      if (waAccount?.data) {
        const waData = JSON.parse(waAccount.data) as { instanceName?: string };
        if (waData.instanceName) {
          await disconnectInstance(waData.instanceName);
          console.info('[ADMIN ORGS] Evolution instance deletada:', waData.instanceName);
        }
      }
    } catch (evoErr) {
      const msg = evoErr instanceof Error ? evoErr.message : String(evoErr);
      console.warn('[ADMIN ORGS] Falha ao deletar na Evolution:', msg);
      warnings.push(`Falha ao desconectar WhatsApp: ${msg}`);
    }

    // ── PASSO 5: Deletar organização do CRM (cascade) ─────────────────────────
    await prisma.organization.delete({ where: { id } });

    // ── PASSO 6: Retorno com warnings se houver ───────────────────────────────
    return NextResponse.json({
      success: true,
      message: `Organização "${existing.name}" removida com sucesso`,
      ...(warnings.length > 0 && { warnings }),
    });

  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao deletar:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}