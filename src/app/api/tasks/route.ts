// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Helper: transforma string vazia em undefined (para campos opcionais UUID)
// Usa preprocess para limpar ANTES da validação UUID
const optionalUuid = z.preprocess(
  (val) => {
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  },
  z.string().uuid().optional()
);

// Helper: transforma string vazia em undefined (para campos opcionais string)
const optionalString = z.preprocess(
  (val) => {
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  },
  z.string().optional()
);

// Helper: transforma string/number em number ou undefined
const optionalNumber = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    return typeof num === 'number' && !isNaN(num) ? num : undefined;
  },
  z.number().optional()
);

// Schema de validação para criar task
const createTaskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
  description: optionalString,
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: optionalString,
  startDate: optionalString,
  isRecurring: z.boolean().default(false),
  recurrenceRule: optionalString,
  estimatedMinutes: optionalNumber,
  projectId: optionalUuid,
  leadId: optionalUuid,
  assignedToId: optionalUuid,
});

// Schema de filtros
const filtersSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedToId: z.string().optional(),
  projectId: z.string().optional(),
  leadId: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  isOverdue: z.string().optional(),
  isToday: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

// GET /api/tasks - Listar tasks com filtros e isolamento multi-tenant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const params = filtersSchema.parse(Object.fromEntries(searchParams));

    // Paginação
    const page = parseInt(params.page || '1');
    const pageSize = parseInt(params.pageSize || '20');
    const skip = (page - 1) * pageSize;

    // Construir where clause — SEMPRE filtrar por organização
    const where: any = {
      organizationId,
    };

    // Filtro por status (pode ser múltiplo: "todo,in_progress")
    if (params.status) {
      const statuses = params.status.split(',');
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    // Filtro por prioridade
    if (params.priority) {
      const priorities = params.priority.split(',');
      where.priority = priorities.length === 1 ? priorities[0] : { in: priorities };
    }

    // Filtro por responsável
    if (params.assignedToId) {
      where.assignedToId = params.assignedToId;
    }

    // Filtro por projeto
    if (params.projectId) {
      where.projectId = params.projectId;
    }

    // Filtro por lead
    if (params.leadId) {
      where.leadId = params.leadId;
    }

    // Filtro por data
    if (params.dueDateFrom || params.dueDateTo) {
      where.dueDate = {};
      if (params.dueDateFrom) {
        where.dueDate.gte = new Date(params.dueDateFrom);
      }
      if (params.dueDateTo) {
        where.dueDate.lte = new Date(params.dueDateTo);
      }
    }

    // Filtro: tarefas atrasadas
    if (params.isOverdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['done', 'cancelled'] };
    }

    // Filtro: tarefas de hoje
    if (params.isToday === 'true') {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      where.dueDate = { gte: startOfDay, lte: endOfDay };
    }

    // Busca textual
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Buscar tasks
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          project: {
            select: { id: true, title: true },
          },
          lead: {
            select: { id: true, name: true },
          },
          assignedTo: {
            select: { id: true, name: true, avatarUrl: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          subtasks: {
            orderBy: { position: 'asc' },
          },
          _count: {
            select: {
              subtasks: true,
            },
          },
        },
        orderBy: [
          { dueDate: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    // Buscar contagem de attachments e comments separadamente
    const taskIds = tasks.map(t => t.id);

    const [attachmentCounts, commentCounts] = await Promise.all([
      prisma.attachment.groupBy({
        by: ['entityId'],
        where: { entityType: 'task', entityId: { in: taskIds } },
        _count: true,
      }),
      prisma.comment.groupBy({
        by: ['entityId'],
        where: { entityType: 'task', entityId: { in: taskIds } },
        _count: true,
      }),
    ]);

    // Mapear contagens
    const attachmentMap = new Map(attachmentCounts.map(a => [a.entityId, a._count]));
    const commentMap = new Map(commentCounts.map(c => [c.entityId, c._count]));

    // Formatar resposta
    const formattedTasks = tasks.map(task => ({
      ...task,
      dueDate: task.dueDate?.toISOString(),
      startDate: task.startDate?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      subtasks: task.subtasks.map(st => ({
        ...st,
        completedAt: st.completedAt?.toISOString(),
        createdAt: st.createdAt.toISOString(),
      })),
      _count: {
        subtasks: task._count.subtasks,
        attachments: attachmentMap.get(task.id) || 0,
        comments: commentMap.get(task.id) || 0,
      },
    }));

    return NextResponse.json({
      tasks: formattedTasks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Erro ao buscar tasks:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Criar nova task com isolamento multi-tenant
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const body = await request.json();

    // Log para debug (remover após resolver)
    console.log('[POST /api/tasks] Body recebido:', JSON.stringify(body));

    const data = createTaskSchema.parse(body);

    console.log('[POST /api/tasks] Dados validados:', JSON.stringify(data));

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        isRecurring: data.isRecurring,
        recurrenceRule: data.recurrenceRule,
        estimatedMinutes: data.estimatedMinutes,
        projectId: data.projectId || null,
        leadId: data.leadId || null,
        assignedToId: data.assignedToId || null,
        createdById: session.user.id,
        organizationId,
      },
      include: {
        project: { select: { id: true, title: true } },
        lead: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        subtasks: true,
      },
    });

    // Criar notificação se atribuiu a alguém
    if (data.assignedToId && data.assignedToId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: data.assignedToId,
          type: 'task_assigned',
          title: 'Nova tarefa atribuída',
          message: `Você foi atribuído à tarefa "${task.title}"`,
          entityType: 'task',
          entityId: task.id,
        },
      });
    }

    // Registrar atividade
    await prisma.activity.create({
      data: {
        entityType: 'task',
        entityId: task.id,
        action: 'created',
        description: `Tarefa "${task.title}" criada`,
        userId: session.user.id,
        projectId: task.projectId,
      },
    });

    // Formatar resposta
    return NextResponse.json({
      ...task,
      dueDate: task.dueDate?.toISOString(),
      startDate: task.startDate?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      subtasks: task.subtasks.map(st => ({
        ...st,
        completedAt: st.completedAt?.toISOString(),
        createdAt: st.createdAt.toISOString(),
      })),
      _count: {
        subtasks: 0,
        attachments: 0,
        comments: 0,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[POST /api/tasks] Zod validation error:', JSON.stringify(error.errors));
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Erro ao criar task:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
