import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';

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
          maxUsers: true,
          maxLeads: true,
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

    // Formata resposta
    const formattedOrgs = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      maxUsers: org.maxUsers,
      maxLeads: org.maxLeads,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      users: org._count.users,
      leads: org._count.leads,
      projects: org._count.projects,
      tasks: org._count.tasks,
      serviceOrders: org._count.serviceOrders,
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
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { name, slug, plan, maxUsers, maxLeads } = body;

    // Validações
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Nome e slug são obrigatórios' },
        { status: 400 }
      );
    }

    // Normaliza slug
    const normalizedSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Verifica slug duplicado
    const existing = await prisma.organization.findUnique({
      where: { slug: normalizedSlug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma organização com este slug' },
        { status: 409 }
      );
    }

    // Cria organização
    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug: normalizedSlug,
        plan: plan || 'free',
        maxUsers: maxUsers || 5,
        maxLeads: maxLeads || 500,
      },
    });

    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    console.error('[ADMIN ORGS] Erro ao criar:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
