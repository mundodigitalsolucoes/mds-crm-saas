// src/app/api/admin/organizations/route.ts
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { provisionChatwootForOrg, getChatwootProvisionStatus } from '@/lib/integrations/chatwoot-provision';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgCreateSchema, adminUserCreateSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search     = searchParams.get('search')?.trim() || '';
    const page       = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit      = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const planFilter = searchParams.get('plan') || '';
    const showInactive = searchParams.get('inactive') === 'true';
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {
      // Por padrão só mostra orgs ativas (deletedAt = null)
      // Se ?inactive=true mostra as inativas também
      deletedAt: showInactive ? { not: null } : null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (planFilter) where.plan = planFilter;

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          planStatus: true,
          trialEndsAt: true,
          maxUsers: true,
          maxLeads: true,
          maxProjects: true,
          maxOs: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              leads: true,
              projects: true,
              tasks: true,
              serviceOrders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    const formattedOrgs = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
      deletedAt: org.deletedAt,
      limits: {
        maxUsers: org.maxUsers,
        maxLeads: org.maxLeads,
        maxProjects: org.maxProjects,
        maxOs: org.maxOs,
      },
      usage: {
        users: org._count.users,
        leads: org._count.leads,
        projects: org._count.projects,
        tasks: org._count.tasks,
        serviceOrders: org._count.serviceOrders,
      },
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }));

    return NextResponse.json({
      organizations: formattedOrgs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao listar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

const organizationOnboardingSchema = adminOrgCreateSchema.extend({
  // Preserve the legacy organization-only API; the Super Admin UI requires owner.
  owner: adminUserCreateSchema.pick({ name: true, email: true, password: true }).optional(),
});
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const parsed = parseBody(organizationOnboardingSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;
    if (!data.name || !data.slug) return NextResponse.json({error:'Nome e identificador são obrigatórios'}, {status:400});
    if (await prisma.organization.findUnique({ where: { slug: data.slug } })) return NextResponse.json({ error: 'Já existe uma organização com este slug' }, { status: 409 });
    if (data.syncFromPlan && !await prisma.plan.findUnique({ where: { name: data.plan } })) return NextResponse.json({ error: 'Plano selecionado indisponível' }, { status: 400 });
    if (data.owner && await prisma.user.findUnique({ where: { email: data.owner.email }, select: { id: true } })) return NextResponse.json({ error: 'Email do proprietário indisponível' }, { status: 409 });
    const hash = data.owner ? await bcrypt.hash(data.owner.password, 10) : null;
    const created = await prisma.$transaction(async tx => {
      const org = await tx.organization.create({ data: { name: data.name, slug: data.slug, plan: data.plan, planStatus: 'active',
        trialEndsAt: data.plan === 'trial' ? new Date(Date.now() + 14 * 86400000) : null,
        maxUsers: data.maxUsers, maxLeads: data.maxLeads, maxProjects: data.maxProjects, maxOs: data.maxOs } });
      const owner = data.owner && hash ? await tx.user.create({ data: { organizationId: org.id, name: data.owner.name, email: data.owner.email, passwordHash: hash, role: 'owner' }, select: { id: true, name: true, email: true } }) : null;
      await tx.activity.create({ data: { entityType: 'organization', entityId: org.id, action: 'created', userId: null,
        description: 'Organização criada pelo Super Admin', metadata: JSON.stringify({ actorId: admin.id, ownerCreated: !!owner }) } });
      return { org, owner };
    });
    let org = created.org, synced = false;
    if (data.syncFromPlan) {
      const planOrg = await syncPlanLimits(org.id, data.plan);
      if (!planOrg) return NextResponse.json({ ...org, owner: created.owner, onboarding: { success: false, error: 'plan_sync_required' }, message: 'Organização preservada; revisar sincronização do plano antes do Atendimento' }, { status: 201 });
      org = planOrg; synced = true;
    }
    const result = created.owner ? await provisionChatwootForOrg({ organizationId: org.id, orgName: org.name, orgSlug: org.slug,
      ownerUserId: created.owner.id, ownerName: created.owner.name, ownerEmail: created.owner.email, allowCreate: true, actorId: admin.id }) : null;
    const status = await getChatwootProvisionStatus(org.id);
    return NextResponse.json({ ...org, chatwootAccountId: status?.chatwootAccountId ?? org.chatwootAccountId, _syncedFromPlan: synced, owner: created.owner,
      onboarding: { ...status, success: result?.success ?? false, error: result?.error ?? null },
      message: result?.success ? 'Organização e proprietário criados; Atendimento configurado para cadastrar inboxes' : 'Organização criada; Atendimento pendente de configuração ou recuperação' },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Organização ou email já cadastrado' }, { status: 409 });
    // Never log the request body, passwords, provider responses or credentials.
    return NextResponse.json({ error: 'Não foi possível concluir a criação; confira a lista antes de repetir' }, { status: 500 });
  }
}
