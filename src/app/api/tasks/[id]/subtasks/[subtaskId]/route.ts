// src/app/api/tasks/[id]/subtasks/[subtaskId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  completed: z.boolean().optional(),
  position: z.number().optional(),
});

/**
 * Verifica se a task pertence à organização do usuário (isolamento multi-tenant)
 */
async function validateTaskOwnership(taskId: string, organizationId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId },
    select: { id: true },
  });
  return task;
}

// PUT /api/tasks/[id]/subtasks/[subtaskId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const { id, subtaskId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Multi-tenant: verificar se a task pai pertence à organização
    const task = await validateTaskOwnership(id, session.user.organizationId);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const data = updateSubtaskSchema.parse(body);

    // Verificar se a subtask pertence à task
    const currentSubtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
    });

    if (!currentSubtask || currentSubtask.taskId !== id) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.position !== undefined) updateData.position = data.position;

    // Gerenciar completedAt ao mudar status de conclusão
    if (data.completed !== undefined) {
      updateData.completed = data.completed;
      if (data.completed && !currentSubtask.completed) {
        updateData.completedAt = new Date();
      } else if (!data.completed && currentSubtask.completed) {
        updateData.completedAt = null;
      }
    }

    const subtask = await prisma.subtask.update({
      where: { id: subtaskId },
      data: updateData,
    });

    return NextResponse.json({
      ...subtask,
      completedAt: subtask.completedAt?.toISOString(),
      createdAt: subtask.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Erro ao atualizar subtask:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id]/subtasks/[subtaskId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const { id, subtaskId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Multi-tenant: verificar se a task pai pertence à organização
    const task = await validateTaskOwnership(id, session.user.organizationId);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Verificar se a subtask pertence à task
    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
    });

    if (!subtask || subtask.taskId !== id) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 });
    }

    await prisma.subtask.delete({
      where: { id: subtaskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar subtask:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
