// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Helper: transforma string vazia em null/undefined para campos UUID opcionais
const optionalUuidNullable = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined; // campo não enviado
    if (val === null || val.trim() === '') return null; // campo limpo explicitamente
    return val;
  })
  .pipe(z.string().uuid().optional().nullable());

// Helper: transforma string vazia em null para campos string opcionais
const optionalStringNullable = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null || val.trim() === '') return null;
    return val;
  });

// Helper: transforma string/number em number ou null
const optionalNumberNullable = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null || val === '') return null;
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    return isNaN(num as number) ? null : num;
  });

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: optionalStringNullable,
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: optionalStringNullable,
  startDate: optionalStringNullable,
  isRecurring: z.boolean().optional(),
  recurrenceRule: optionalStringNullable,
  estimatedMinutes: optionalNumberNullable,
  actualMinutes: optionalNumberNullable,
  projectId: optionalUuidNullable,
  leadId: optionalUuidNullable,
  assignedToId: optionalUuidNullable,
});

// GET /api/tasks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    const task = await prisma.task.findFirst({
      where: { id, organizationId },
      include: {
        project: { select: { id: true, title: true } },
        lead: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        subtasks: { orderBy: { position: 'asc' } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const [attachments, comments] = await Promise.all([
      prisma.attachment.findMany({
        where: { entityType: 'task', entityId: task.id },
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.comment.findMany({
        where: { entityType: 'task', entityId: task.id, parentId: null },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const commentIds = comments.map(c => c.id);
    const replies = commentIds.length > 0
      ? await prisma.comment.findMany({
          where: { parentId: { in: commentIds } },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const repliesMap = new Map<string, typeof replies>();
    replies.forEach(reply => {
      if (!repliesMap.has(reply.parentId!)) {
        repliesMap.set(reply.parentId!, []);
      }
      repliesMap.get(reply.parentId!)!.push(reply);
    });

    const commentsWithReplies = comments.map(comment => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: (repliesMap.get(comment.id) || []).map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    }));

    const [attachmentCount, commentCount] = await Promise.all([
      prisma.attachment.count({ where: { entityType: 'task', entityId: task.id } }),
      prisma.comment.count({ where: { entityType: 'task', entityId: task.id } }),
    ]);

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
      attachments: attachments.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      comments: commentsWithReplies,
      _count: {
        subtasks: task.subtasks.length,
        attachments: attachmentCount,
        comments: commentCount,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar task:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    // Verificar se a task pertence à organização
    const currentTask = await prisma.task.findFirst({
      where: { id, organizationId },
    });

    if (!currentTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Copiar campos — undefined = não enviado (não altera), null = limpar campo
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule;
    if (data.estimatedMinutes !== undefined) updateData.estimatedMinutes = data.estimatedMinutes;
    if (data.actualMinutes !== undefined) updateData.actualMinutes = data.actualMinutes;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.leadId !== undefined) updateData.leadId = data.leadId;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;

    // Converter datas
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }

    // Gerenciar completedAt
    if (data.status === 'done' && currentTask.status !== 'done') {
      updateData.completedAt = new Date();
    } else if (data.status && data.status !== 'done' && currentTask.status === 'done') {
      updateData.completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, title: true } },
        lead: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        subtasks: { orderBy: { position: 'asc' } },
      },
    });

    // Notificação se atribuiu a alguém novo
    if (data.assignedToId &&
        data.assignedToId !== currentTask.assignedToId &&
        data.assignedToId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: data.assignedToId,
          type: 'task_assigned',
          title: 'Tarefa atribuída a você',
          message: `Você foi atribuído à tarefa "${task.title}"`,
          entityType: 'task',
          entityId: task.id,
        },
      });
    }

    // Notificação se concluiu
    if (data.status === 'done' &&
        currentTask.status !== 'done' &&
        currentTask.createdById &&
        currentTask.createdById !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: currentTask.createdById,
          type: 'task_completed',
          title: 'Tarefa concluída',
          message: `A tarefa "${task.title}" foi concluída`,
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
        action: data.status === 'done' ? 'completed' : 'updated',
        description: data.status === 'done'
          ? `Tarefa "${task.title}" concluída`
          : `Tarefa "${task.title}" atualizada`,
        userId: session.user.id,
        projectId: task.projectId,
      },
    });

    // Buscar contagens atualizadas
    const [attachmentCount, commentCount] = await Promise.all([
      prisma.attachment.count({ where: { entityType: 'task', entityId: task.id } }),
      prisma.comment.count({ where: { entityType: 'task', entityId: task.id } }),
    ]);

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
        subtasks: task.subtasks.length,
        attachments: attachmentCount,
        comments: commentCount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Erro ao atualizar task:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    const task = await prisma.task.findFirst({
      where: { id, organizationId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Deletar dependências primeiro, depois a task
    await Promise.all([
      prisma.attachment.deleteMany({
        where: { entityType: 'task', entityId: id },
      }),
      prisma.comment.deleteMany({
        where: { entityType: 'task', entityId: id },
      }),
      prisma.subtask.deleteMany({
        where: { taskId: id },
      }),
    ]);

    await prisma.task.delete({
      where: { id },
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        entityType: 'task',
        entityId: id,
        action: 'deleted',
        description: `Tarefa "${task.title}" excluída`,
        userId: session.user.id,
        projectId: task.projectId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar task:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
