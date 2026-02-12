// src/app/api/tasks/[id]/subtasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const createSubtaskSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
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

// GET /api/tasks/[id]/subtasks
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

    // Multi-tenant: verificar se a task pertence à organização
    const task = await validateTaskOwnership(id, session.user.organizationId);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const subtasks = await prisma.subtask.findMany({
      where: { taskId: id },
      orderBy: { position: 'asc' },
    });

    return NextResponse.json(
      subtasks.map(st => ({
        ...st,
        completedAt: st.completedAt?.toISOString(),
        createdAt: st.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar subtasks:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/[id]/subtasks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Multi-tenant: verificar se a task pertence à organização
    const task = await validateTaskOwnership(id, session.user.organizationId);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const data = createSubtaskSchema.parse(body);

    // Buscar última posição para auto-incrementar
    const lastSubtask = await prisma.subtask.findFirst({
      where: { taskId: id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = data.position ?? (lastSubtask ? lastSubtask.position + 1 : 0);

    const subtask = await prisma.subtask.create({
      data: {
        taskId: id,
        title: data.title,
        position,
      },
    });

    return NextResponse.json({
      ...subtask,
      completedAt: subtask.completedAt?.toISOString(),
      createdAt: subtask.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Erro ao criar subtask:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
