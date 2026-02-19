// src/app/api/projects/[id]/route.ts
// Detalhe, atualização e exclusão de projeto com permissões granulares
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, projectUpdateSchema } from '@/lib/validations';

// GET /api/projects/[id] — Buscar projeto por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Permissão granular: projects.view
    const { allowed, session, errorResponse } = await checkPermission('projects', 'view');
    if (!allowed) return errorResponse!;

    const { id } = await params;

    const project = await prisma.marketingProject.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { tasks: true, kanbanBoards: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Erro ao buscar projeto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/projects/[id] — Atualizar projeto
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Permissão granular: projects.edit
    const { allowed, session, errorResponse } = await checkPermission('projects', 'edit');
    if (!allowed) return errorResponse!;

    const { id } = await params;
    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(projectUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Verificar se projeto existe e pertence à organização
    const existing = await prisma.marketingProject.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    // Montar objeto de atualização apenas com campos enviados
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.client !== undefined) updateData.client = data.client;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.budget !== undefined) updateData.budget = data.budget;
    if (data.spent !== undefined) updateData.spent = data.spent;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    const project = await prisma.marketingProject.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] — Excluir projeto
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Permissão granular: projects.delete
    const { allowed, session, errorResponse } = await checkPermission('projects', 'delete');
    if (!allowed) return errorResponse!;

    const { id } = await params;

    // Verificar se projeto existe e pertence à organização
    const existing = await prisma.marketingProject.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    await prisma.marketingProject.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Projeto excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir projeto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
