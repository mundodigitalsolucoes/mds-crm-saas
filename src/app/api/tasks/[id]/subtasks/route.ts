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

// GET /api/tasks/[id]/subtasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
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
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const data = createSubtaskSchema.parse(body);

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const lastSubtask = await prisma.subtask.findFirst({
      where: { taskId: id },
      orderBy: { position: 'desc' },
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
