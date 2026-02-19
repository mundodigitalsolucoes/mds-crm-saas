// src/app/api/admin/organizations/route.ts
// API Admin — Listagem e Criação de Organizações (com syncPlanLimits)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { syncPlanLimits } from '@/lib/checkLimits';
import { parseBody, adminOrgCreateSchema } from '@/lib/validations';

/**
 * GET /api/admin/organizations — Lista todas as organizações com métricas
 * Query params: ?search=texto&page=1&limit=10&plan=free
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const planFilter = searchParams.get('plan') || '';
    const skip = (page - 1) * limit;

    // Monta filtro dinâmico
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (planFilter) {
      where.plan = planFilter;
    }

    // Busca organizações com contagens
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

    // Formata resposta com todos os limites
    const formattedOrgs = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
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
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao listar:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/organizations — Cria nova organização
 * Se syncFromPlan=true (default), copia limites do Plan.
 * Se false, usa os valores manuais enviados.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(adminOrgCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Verifica slug duplicado
    const existing = await prisma.organization.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma organização com este slug' },
        { status: 409 }
      );
    }

    // Cria organização com limites manuais iniciais
    const org = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        plan: data.plan,
        planStatus: data.plan === 'trial' ? 'active' : 'active',
        trialEndsAt: data.plan === 'trial'
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 dias
          : null,
        maxUsers: data.maxUsers,
        maxLeads: data.maxLeads,
        maxProjects: data.maxProjects,
        maxOs: data.maxOs,
      },
    });

    // ✅ Se syncFromPlan=true, sobrescreve com os limites do Plan
    if (data.syncFromPlan) {
      const synced = await syncPlanLimits(org.id, data.plan);
      if (synced) {
        return NextResponse.json(
          {
            ...synced,
            _syncedFromPlan: true,
            message: `Organização criada com limites do plano "${data.plan}"`,
          },
          { status: 201 }
        );
      }
      // Se plano não encontrado no banco, mantém os limites manuais (graceful)
      console.warn(`[ADMIN ORGS] Plano "${data.plan}" não encontrado no banco. Limites manuais mantidos.`);
    }

    return NextResponse.json(
      {
        ...org,
        _syncedFromPlan: false,
        message: 'Organização criada com limites customizados',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao criar:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
