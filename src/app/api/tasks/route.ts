// src/app/api/tasks/route.ts
// CRUD de tasks com permissões granulares e multi-tenant
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, taskCreateSchema, taskFiltersSchema } from '@/lib/validations';
import { createNotification } from '@/lib/notify';

// GET /api/tasks - Listar tasks com filtros e isolamento multi-tenant
export async function GET(request: NextRequest) {
  try {
    // ✅ Permissão granular: tasks.view
    const { allowed, session, errorResponse } = await checkPermission('tasks', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const { searchParams } = new URL(request.url);
    const params = taskFiltersSchema.parse(Object.fromEntries(searchParams));

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

    // Filtro: tarefas de hoje — usa UTC-3 (America/Sao_Paulo) explícito
    if (params.isToday === 'true') {
      // Offset UTC-3 em ms
      const TZ_OFFSET_MS = -3 * 60 * 60 * 1000;

      // "Agora" no horário de Brasília
      const nowUtc = Date.now();
      const nowBrt = new Date(nowUtc + TZ_OFFSET_MS);

      // Início do dia BRT → converte de volta para UTC para salvar no Prisma
      const startBrt = new Date(
        Date.UTC(
          nowBrt.getUTCFullYear(),
          nowBrt.getUTCMonth(),
          nowBrt.getUTCDate(),
          0, 0, 0, 0
        ) - TZ_OFFSET_MS
      );

      // Fim do dia BRT → converte de volta para UTC
      const endBrt = new Date(
        Date.UTC(
          nowBrt.getUTCFullYear(),
          nowBrt.getUTCMonth(),
          nowBrt.getUTCDate(),
          23, 59, 59, 999
        ) - TZ_OFFSET_MS
      );

      where.dueDate = { gte: startBrt, lte: endBrt };
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
    // ✅ Permissão granular: tasks.create
    const { allowed, session, errorResponse } = await checkPermission('tasks', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;
    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(taskCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

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
        createdById: userId,
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

    // ✅ Notificar responsável atribuído (se diferente de quem criou)
    if (data.assignedToId && data.assignedToId !== userId) {
      await createNotification({
        userId: data.assignedToId,
        type: 'task_assigned',
        title: 'Nova tarefa atribuída',
        message: `Você foi atribuído à tarefa "${task.title}"`,
        entityType: 'task',
        entityId: task.id,
      });
    }

    // Registrar atividade
    await prisma.activity.create({
      data: {
        entityType: 'task',
        entityId: task.id,
        action: 'created',
        description: `Tarefa "${task.title}" criada`,
        userId,
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
    console.error('Erro ao criar task:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
