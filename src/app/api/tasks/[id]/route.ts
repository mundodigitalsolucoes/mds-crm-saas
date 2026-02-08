// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional().nullable(),
  estimatedMinutes: z.number().optional().nullable(),
  actualMinutes: z.number().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
});

interface RouteParams {
  params: { id: string };
}

// GET /api/tasks/[id] - Buscar task por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
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

    // Buscar attachments e comments
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

    // Buscar replies dos comments
    const commentIds = comments.map(c => c.id);
    const replies = await prisma.comment.findMany({
      where: { parentId: { in: commentIds } },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Agrupar replies por parentId
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
    });
  } catch (error) {
    console.error('Erro ao buscar task:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Atualizar task
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    // Buscar task atual para comparar mudanças
    const currentTask = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!currentTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Preparar dados de atualização
    const updateData: any = { ...data };

    // Converter datas
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }

    // Se mudou para 'done', registrar completedAt
    if (data.status === 'done' && currentTask.status !== 'done') {
      updateData.completedAt = new Date();
    } else if (data.status && data.status !== 'done' && currentTask.status === 'done') {
      updateData.completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
      include: {
        project: { select: { id: true, title: true } },
        lead: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        subtasks: { orderBy: { position: 'asc' } },
      },
    });

    // Notificar se atribuiu a outra pessoa
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

    // Notificar conclusão ao criador
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

    return NextResponse.json({
      ...task,
      dueDate: task.dueDate?.toISOString(),
      startDate: task.startDate?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
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

// DELETE /api/tasks/[id] - Deletar task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Deletar attachments do storage (se houver)
    // TODO: Implementar deleção de arquivos do storage

    // Deletar task (cascade deleta subtasks)
    await prisma.task.delete({
      where: { id: params.id },
    });

    // Deletar attachments e comments relacionados
    await Promise.all([
      prisma.attachment.deleteMany({
        where: { entityType: 'task', entityId: params.id },
      }),
      prisma.comment.deleteMany({
        where: { entityType: 'task', entityId: params.id },
      }),
    ]);

    // Registrar atividade
    await prisma.activity.create({
      data: {
        entityType: 'task',
        entityId: params.id,
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
