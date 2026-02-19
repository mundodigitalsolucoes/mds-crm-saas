// src/app/api/projects/route.ts
// CRUD de projetos com permissões granulares, limites de plano e multi-tenant
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { checkOrganizationLimit, checkPlanActive } from '@/lib/checkLimits';
import { parseBody, projectCreateSchema } from '@/lib/validations';

// GET /api/projects — Listar projetos com busca e paginação
export async function GET(request: NextRequest) {
  try {
    // ✅ Permissão granular: projects.view
    const { allowed, session, errorResponse } = await checkPermission('projects', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Filtro base: isolamento multi-tenant
    const where: any = {
      organizationId,
    };

    // Filtro por busca (título, cliente, descrição)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { client: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por status
    if (status) {
      where.status = status;
    }

    // Buscar projetos + contagem total em paralelo
    const [projects, total] = await Promise.all([
      prisma.marketingProject.findMany({
        where,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.marketingProject.count({ where }),
    ]);

    return NextResponse.json({
      projects,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/projects — Criar novo projeto
export async function POST(request: NextRequest) {
  try {
    // ✅ Permissão granular: projects.create
    const { allowed, session, errorResponse } = await checkPermission('projects', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    // ✅ Verificar se plano está ativo
    const planCheck = await checkPlanActive(organizationId);
    if (!planCheck.active) return planCheck.errorResponse!;

    // ✅ Verificar limite de projetos do plano
    const limitCheck = await checkOrganizationLimit(organizationId, 'projects');
    if (!limitCheck.allowed) return limitCheck.errorResponse!;

    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(projectCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const project = await prisma.marketingProject.create({
      data: {
        organizationId,
        title: data.title,
        description: data.description || null,
        client: data.client || null,
        status: data.status,
        priority: data.priority,
        budget: data.budget,
        spent: data.spent,
        progress: data.progress,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        ownerId: userId,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
