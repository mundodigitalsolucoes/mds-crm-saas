import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema de validação para criar projeto
const createProjectSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional().nullable(),
  client: z.string().optional().nullable(),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']).default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  budget: z.number().min(0).default(0),
  spent: z.number().min(0).default(0),
  progress: z.number().min(0).max(100).default(0),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// GET /api/projects — Listar projetos com busca e paginação
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Filtro base: isolamento multi-tenant
    const where: any = {
      organizationId: session.user.organizationId,
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const project = await prisma.marketingProject.create({
      data: {
        organizationId: session.user.organizationId,
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
        ownerId: session.user.id,
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
