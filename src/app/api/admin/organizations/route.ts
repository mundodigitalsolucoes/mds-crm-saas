// src/app/api/admin/organizations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgCreateSchema } from '@/lib/validations';

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

    const where: any = {
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

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body   = await req.json();
    const parsed = parseBody(adminOrgCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Verifica slug duplicado (incluindo orgs inativas)
    const existing = await prisma.organization.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma organização com este slug' },
        { status: 409 }
      );
    }

    const org = await prisma.organization.create({
      data: {
        name:        data.name,
        slug:        data.slug,
        plan:        data.plan,
        planStatus:  'active',
        trialEndsAt: data.plan === 'trial'
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          : null,
        maxUsers:    data.maxUsers,
        maxLeads:    data.maxLeads,
        maxProjects: data.maxProjects,
        maxOs:       data.maxOs,
      },
    });

    if (data.syncFromPlan) {
      const synced = await syncPlanLimits(org.id, data.plan);
      if (synced) {
        return NextResponse.json(
          { ...synced, _syncedFromPlan: true, message: `Organização criada com limites do plano "${data.plan}"` },
          { status: 201 }
        );
      }
      console.warn(`[ADMIN ORGS] Plano "${data.plan}" não encontrado. Limites manuais mantidos.`);
    }

    return NextResponse.json(
      { ...org, _syncedFromPlan: false, message: 'Organização criada com limites customizados' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao criar:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}