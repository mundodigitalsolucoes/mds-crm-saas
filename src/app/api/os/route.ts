// src/app/api/os/route.ts
// API de Ordens de Serviço — Listagem e Criação com permissões granulares e limites de plano
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { checkOrganizationLimit, checkPlanActive } from '@/lib/checkLimits';
import { parseBody, osCreateSchema } from '@/lib/validations';

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
    // ✅ Permissão granular: os.view
    const { allowed, session, errorResponse } = await checkPermission('os', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Filtros com isolamento multi-tenant
    const where: any = {
      organizationId,
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
    // ✅ Permissão granular: os.create
    const { allowed, session, errorResponse } = await checkPermission('os', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    // ✅ Verificar se plano está ativo
    const planCheck = await checkPlanActive(organizationId);
    if (!planCheck.active) return planCheck.errorResponse!;

    // ✅ Verificar limite de OS do plano
    const limitCheck = await checkOrganizationLimit(organizationId, 'os');
    if (!limitCheck.allowed) return limitCheck.errorResponse!;

    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(osCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Gerar código automático
    const code = await generateOSCode(organizationId);

    const serviceOrder = await prisma.serviceOrder.create({
      data: {
        organizationId,
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
        createdById: userId,
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
