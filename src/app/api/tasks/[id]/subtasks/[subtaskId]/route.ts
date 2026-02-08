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

// PUT /api/tasks/[id]/subtasks/[subtaskId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const { id, subtaskId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const data = updateSubtaskSchema.parse(body);

    const currentSubtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
    });

    if (!currentSubtask || currentSubtask.taskId !== id) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...data };

    if (data.completed !== undefined) {
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
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

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
