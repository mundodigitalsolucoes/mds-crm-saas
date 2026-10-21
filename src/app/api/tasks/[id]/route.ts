import { taskCommercialDenial } from '@/lib/authorization/guards';
// src/app/api/tasks/[id]/route.ts
// Detalhe, atualização e exclusão de task com permissões granulares
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resourceReadScope, validateResourceReferences, relationError, lockResource, resourceNotification, taskAttachmentsScope, taskCommentsScope } from '@/lib/task-os-relations';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, taskUpdateSchema } from '@/lib/validations';

function parseLocalDate(dateString: string) {
  if (dateString.includes('T')) {
    return new Date(dateString);
  }

  const [year, month, day] = dateString.split('-').map(Number);

  return new Date(year, month - 1, day, 12, 0, 0);
}

// GET /api/tasks/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ✅ Permissão granular: tasks.view
    const { allowed, session, errorResponse } = await checkPermission('tasks', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    return await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id, ...await resourceReadScope(organizationId, 'task') },
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
        tx.attachment.findMany({
          where: { ...taskAttachmentsScope(organizationId), entityId: task.id },
          include: {
            uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        tx.comment.findMany({
          where: { ...taskCommentsScope(organizationId), entityId: task.id, parentId: null },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      const commentIds = comments.map(c => c.id);
      const replies = commentIds.length > 0
        ? await tx.comment.findMany({
            where: { ...taskCommentsScope(organizationId), entityId: task.id, parentId: { in: commentIds } },
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
        tx.attachment.count({ where: { ...taskAttachmentsScope(organizationId), entityId: task.id } }),
        tx.comment.count({ where: { ...taskCommentsScope(organizationId), entityId: task.id } }),
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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

    // ✅ Permissão granular: tasks.edit
    const { allowed, session, errorResponse } = await checkPermission('tasks', 'edit');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;
    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(taskUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    return await prisma.$transaction(async (tx) => {
      await lockResource(tx, 'task', id, organizationId);
      // Verificar se a task pertence à organização
      const currentTask = await tx.task.findFirst({
        where: { id, ...await resourceReadScope(organizationId, 'task') },
      });

      if (!currentTask) {
        return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
      }

      const commercialDenied = await taskCommercialDenial(session!, 'edit', { ...currentTask, ...data });
      if (commercialDenied) return commercialDenied;

      const updateData: Record<string, unknown> = {};

      // Copiar campos — undefined = não enviado (não altera), null = limpar campo
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.type !== undefined) updateData.type = data.type;
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
    updateData.dueDate = data.dueDate
      ? parseLocalDate(data.dueDate)
      : null;
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

      await validateResourceReferences(tx, organizationId, userId, {
        ...currentTask,
        projectId: data.projectId !== undefined ? data.projectId : currentTask.projectId,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : currentTask.assignedToId,
        leadId: data.leadId !== undefined ? data.leadId : currentTask.leadId,
      });
      const task = await tx.task.update({
        where: { id, organizationId: session!.user.organizationId },
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
          data.assignedToId !== userId) {
        await resourceNotification(tx, organizationId, task, {
            userId: data.assignedToId,
            type: 'task_assigned',
            title: 'Tarefa atribuída a você',
            message: `Você foi atribuído à tarefa "${task.title}"`,
            entityType: 'task',
            entityId: task.id,
        });
      }

      // Notificação se concluiu
      if (data.status === 'done' &&
          currentTask.status !== 'done' &&
          currentTask.createdById &&
          currentTask.createdById !== userId) {
        await resourceNotification(tx, organizationId, task, {
            userId: currentTask.createdById,
            type: 'task_completed',
            title: 'Tarefa concluída',
            message: `A tarefa "${task.title}" foi concluída`,
            entityType: 'task',
            entityId: task.id,
        });
      }

      // Registrar atividade
      await tx.activity.create({
        data: {
          entityType: 'task',
          entityId: task.id,
          action: data.status === 'done' ? 'completed' : 'updated',
          description: data.status === 'done'
            ? `Tarefa "${task.title}" concluída`
            : `Tarefa "${task.title}" atualizada`,
          userId,
          projectId: task.projectId,
        },
      });

      // Buscar contagens atualizadas
      const [attachmentCount, commentCount] = await Promise.all([
        tx.attachment.count({ where: { ...taskAttachmentsScope(organizationId), entityId: task.id } }),
        tx.comment.count({ where: { ...taskCommentsScope(organizationId), entityId: task.id } }),
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
    });
  } catch (error) {
    const rejection = relationError(error);
    if (rejection) return rejection;
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

    // ✅ Permissão granular: tasks.delete
    const { allowed, session, errorResponse } = await checkPermission('tasks', 'delete');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    return await prisma.$transaction(async (tx) => {
      await lockResource(tx, 'task', id, session!.user.organizationId);
      const task = await tx.task.findFirst({
        where: { id, ...await resourceReadScope(organizationId, 'task') },
      });

      if (!task) {
        return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
      }

      await validateResourceReferences(tx, session!.user.organizationId, session!.user.id, task);
      // Deletar dependências primeiro, depois a task
      await Promise.all([
        tx.attachment.deleteMany({
          where: { ...taskAttachmentsScope(organizationId), entityId: id },
        }),
        tx.comment.deleteMany({
          where: { ...taskCommentsScope(organizationId), entityId: id },
        }),
        tx.subtask.deleteMany({
          where: { taskId: id },
        }),
      ]);

      await tx.task.delete({
        where: { id, organizationId: session!.user.organizationId },
      });

      // Registrar atividade
      await tx.activity.create({
        data: {
          entityType: 'task',
          entityId: id,
          action: 'deleted',
          description: `Tarefa "${task.title}" excluída`,
          userId,
          projectId: task.projectId,
        },
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    const rejection = relationError(error);
    if (rejection) return rejection;
    console.error('Erro ao deletar task:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
