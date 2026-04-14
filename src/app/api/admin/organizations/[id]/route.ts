// src/app/api/admin/organizations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgUpdateSchema } from '@/lib/validations';
import { hardCleanupChatwootAccount } from '@/lib/integrations/chatwoot-cleanup';
import { disconnectInstance } from '@/lib/integrations/evolutionClient';

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
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { leads: true, projects: true, tasks: true, serviceOrders: true },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }

    const whatsappCount = await prisma.whatsappInstance.count({
      where: {
        organizationId: id,
        isActive: true,
      },
    });

    return NextResponse.json({
      ...org,
      limits: {
        maxUsers: org.maxUsers,
        maxLeads: org.maxLeads,
        maxProjects: org.maxProjects,
        maxOs: org.maxOs,
        maxWhatsappInstances: org.maxWhatsappInstances,
      },
      usage: {
        users: org.users.length,
        leads: org._count.leads,
        projects: org._count.projects,
        tasks: org._count.tasks,
        serviceOrders: org._count.serviceOrders,
        whatsappInstances: whatsappCount,
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
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
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
    const targetPlan = data.plan ?? existing.plan;

    /**
     * REGRA NOVA:
     * se syncFromPlan=true e tiver plano definido (novo ou atual),
     * sempre sincroniza os limites do Plan para a Organization.
     *
     * Isso corrige o caso da org já estar com plan="enterprise",
     * mas ainda carregar limites antigos como maxWhatsappInstances=1.
     */
    if (syncFromPlan && targetPlan) {
      const {
        maxUsers,
        maxLeads,
        maxProjects,
        maxOs,
        trialEndsAt,
        ...nonLimitData
      } = updateData;

      if (Object.keys(nonLimitData).length > 0) {
        await prisma.organization.update({
          where: { id },
          data: nonLimitData,
        });
      }

      const synced = await syncPlanLimits(id, targetPlan);

      if (synced) {
        return NextResponse.json({
          ...synced,
          _syncedFromPlan: true,
          message: `Limites sincronizados do plano "${targetPlan}"`,
        });
      }

      console.warn(
        `[ADMIN ORGS] Plano "${targetPlan}" não encontrado. Usando valores manuais.`
      );
    }

    const org = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ...org, _syncedFromPlan: false });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao atualizar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/organizations/:id
 * SOFT DELETE — marca deletedAt na org e em todos os usuários ativos da org.
 * Faz hard cleanup do Chatwoot + desconecta WhatsApp.
 * Também limpa o vínculo local da org com o Chatwoot para evitar ponteiro stale.
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
        users: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    if (!existing) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    if (existing.deletedAt) return NextResponse.json({ error: 'Organização já está inativa' }, { status: 409 });

    let chatwootAccountId: number | null = existing.chatwootAccountId ?? null;
    let chatwootCleanup:
      | {
          contained: boolean;
          blocked: string[];
          apiDeleted: boolean;
          sqlPurged: boolean;
          verified: boolean;
          verification: {
            accountExists: boolean;
            accountUsers: number;
            inboxes: number;
            conversations: number;
            contacts: number;
            messages: number;
            contactInboxes: number;
            conversationParticipants: number;
            inboxMembers: number;
            hasResidualData: boolean;
          };
          errors: string[];
        }
      | null = null;

    if (!chatwootAccountId && existing.connectedAccounts?.[0]?.data) {
      try {
        const cwData = JSON.parse(existing.connectedAccounts[0].data) as { chatwootAccountId?: number };
        chatwootAccountId = cwData.chatwootAccountId ?? null;
      } catch {}
    }

    if (chatwootAccountId) {
      chatwootCleanup = await hardCleanupChatwootAccount(chatwootAccountId);

      if (!chatwootCleanup.verified || chatwootCleanup.errors.length > 0) {
        warnings.push(
          `Falha no hard cleanup do Chatwoot: ${chatwootCleanup.errors.join(', ')}`
        );
      } else {
        console.info(
          `[ADMIN ORGS] Hard cleanup Chatwoot concluído para account #${chatwootAccountId}. blocked=${chatwootCleanup.blocked.join(', ')} apiDeleted=${chatwootCleanup.apiDeleted} sqlPurged=${chatwootCleanup.sqlPurged}`,
        );
      }
    }

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

    const deletedAt = new Date();

    const softDeleteUsersOps = existing.users.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          deletedAt,
        },
      })
    );

    const chatwootCleanupData = JSON.stringify({
      cleanupAppliedAt: deletedAt.toISOString(),
      previousChatwootAccountId: chatwootAccountId,
      verified: chatwootCleanup?.verified ?? false,
      apiDeleted: chatwootCleanup?.apiDeleted ?? false,
      sqlPurged: chatwootCleanup?.sqlPurged ?? false,
      blockedUsers: chatwootCleanup?.blocked ?? [],
      verification: chatwootCleanup?.verification ?? null,
    });

    await prisma.$transaction([
      prisma.organization.update({
        where: { id },
        data: {
          deletedAt,
          planStatus: 'inactive',
          chatwootAccountId: null,
          chatwootUrl: null,
        },
      }),
      prisma.connectedAccount.updateMany({
        where: {
          organizationId: id,
          provider: 'chatwoot',
        },
        data: {
          isActive: false,
          lastError:
            chatwootCleanup && !chatwootCleanup.verified
              ? 'organization_deleted_cleanup_incomplete'
              : null,
          lastSyncAt: deletedAt,
          data: chatwootCleanupData,
        },
      }),
      ...softDeleteUsersOps,
    ]);

    console.info(
      `[ADMIN ORGS] ✅ Org "${existing.name}" marcada como inativa (soft delete) e ${existing.users.length} usuário(s) foram bloqueados`,
    );

    return NextResponse.json({
      success: true,
      message: `Organização "${existing.name}" desativada com sucesso`,
      blockedUsers: existing.users.length,
      chatwootCleanup: chatwootCleanup
        ? {
            accountId: chatwootAccountId,
            verified: chatwootCleanup.verified,
            apiDeleted: chatwootCleanup.apiDeleted,
            sqlPurged: chatwootCleanup.sqlPurged,
            blockedUsers: chatwootCleanup.blocked.length,
            residuals: chatwootCleanup.verification,
          }
        : null,
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao desativar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}