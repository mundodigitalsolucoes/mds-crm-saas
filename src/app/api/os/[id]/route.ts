// src/app/api/os/[id]/route.ts
// API de Ordens de Serviço — Detalhe, Atualização e Exclusão
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema de validação para atualizar OS
const updateOSSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(['implantacao_mds', 'manutencao', 'custom']).optional(),
  status: z.enum(['em_planejamento', 'em_execucao', 'aguardando_cliente', 'concluida', 'cancelada']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  pilares: z.any().optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/os/[id] — Buscar OS por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const serviceOrder = await prisma.serviceOrder.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId, // Isolamento multi-tenant
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
      },
    });

    if (!serviceOrder) {
      return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
    }

    return NextResponse.json(serviceOrder);
  } catch (error) {
    console.error('[API OS] Erro ao buscar:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/os/[id] — Atualizar OS
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se a OS pertence à organização
    const existing = await prisma.serviceOrder.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateOSSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Montar objeto de atualização apenas com campos enviados
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Se marcou como concluída, registrar data
      if (data.status === 'concluida' && !existing.completedAt) {
        updateData.completedAt = new Date();
      }
      // Se reabriu, limpar data de conclusão
      if (data.status !== 'concluida') {
        updateData.completedAt = null;
      }
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.projectId !== undefined) updateData.projectId = data.projectId || null;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
    if (data.pilares !== undefined) {
      updateData.pilares = typeof data.pilares === 'string' ? data.pilares : JSON.stringify(data.pilares);
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const serviceOrder = await prisma.serviceOrder.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(serviceOrder);
  } catch (error) {
    console.error('[API OS] Erro ao atualizar:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/os/[id] — Excluir OS
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se a OS pertence à organização
    const existing = await prisma.serviceOrder.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
    }

    await prisma.serviceOrder.delete({ where: { id } });

    return NextResponse.json({ message: 'OS excluída com sucesso' });
  } catch (error) {
    console.error('[API OS] Erro ao excluir:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
