// src/app/api/os/route.ts
// API de Ordens de Serviço — Listagem e Criação
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema de validação para criar OS
const createOSSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional().nullable(),
  type: z.enum(['implantacao_mds', 'manutencao', 'custom']).default('custom'),
  status: z.enum(['em_planejamento', 'em_execucao', 'aguardando_cliente', 'concluida', 'cancelada']).default('em_planejamento'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  progress: z.number().min(0).max(100).default(0),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  pilares: z.any().optional().default({}),
  notes: z.string().optional().nullable(),
});

// Gerar código sequencial da OS: OS-2026-0001
async function generateOSCode(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OS-${year}-`;

  // Buscar a última OS do ano para esta organização
  const lastOS = await prisma.serviceOrder.findFirst({
    where: {
      organizationId,
      code: { startsWith: prefix },
    },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let nextNumber = 1;
  if (lastOS) {
    const lastNumber = parseInt(lastOS.code.replace(prefix, ''), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// GET /api/os — Listar ordens de serviço
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Filtros com isolamento multi-tenant
    const where: any = {
      organizationId: session.user.organizationId,
    };

    // Busca por título, código ou descrição
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [serviceOrders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.serviceOrder.count({ where }),
    ]);

    return NextResponse.json({
      serviceOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API OS] Erro ao listar:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/os — Criar nova OS
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createOSSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Gerar código automático
    const code = await generateOSCode(session.user.organizationId);

    const serviceOrder = await prisma.serviceOrder.create({
      data: {
        organizationId: session.user.organizationId,
        code,
        title: data.title,
        description: data.description || null,
        type: data.type,
        status: data.status,
        priority: data.priority,
        progress: data.progress,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        projectId: data.projectId || null,
        assignedToId: data.assignedToId || null,
        createdById: session.user.id,
        pilares: typeof data.pilares === 'string' ? data.pilares : JSON.stringify(data.pilares),
        notes: data.notes || null,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(serviceOrder, { status: 201 });
  } catch (error) {
    console.error('[API OS] Erro ao criar:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
