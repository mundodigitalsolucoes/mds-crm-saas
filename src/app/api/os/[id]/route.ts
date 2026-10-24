import { commercialModuleDenial } from '@/lib/authorization/guards';
// src/app/api/os/[id]/route.ts
// API de Ordens de Serviço — Detalhe, Atualização e Exclusão com permissões granulares
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resourceReadScope, validateResourceReferences, relationError, lockResource } from '@/lib/task-os-relations';
import { checkPermission } from '@/lib/checkPermission';
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
    // ✅ Permissão granular: os.view
    const { allowed, session, errorResponse } = await checkPermission('os', 'view');
    if (!allowed) return errorResponse!;
    const commercialDenied = await commercialModuleDenial(session!, { module: 'marketing', permission: 'os', action: 'view' });
    if (commercialDenied) return commercialDenied;

    const { id } = await params;

    return await prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.findFirst({
        where: {
          id,
          ...await resourceReadScope(session!.user.organizationId, 'os'),
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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
    // ✅ Permissão granular: os.edit
    const { allowed, session, errorResponse } = await checkPermission('os', 'edit');
    if (!allowed) return errorResponse!;
    const commercialDenied = await commercialModuleDenial(session!, { module: 'marketing', permission: 'os', action: 'edit' });
    if (commercialDenied) return commercialDenied;

    const { id } = await params;

    return await prisma.$transaction(async (tx) => {
      await lockResource(tx, 'os', id, session!.user.organizationId);
      // Verificar se a OS pertence à organização
      const existing = await tx.serviceOrder.findFirst({
        where: {
          id,
          ...await resourceReadScope(session!.user.organizationId, 'os'),
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
      const updateData: Prisma.ServiceOrderUncheckedUpdateInput = {};

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

      await validateResourceReferences(tx, session!.user.organizationId, session!.user.id, {
        ...existing,
        projectId: data.projectId !== undefined ? data.projectId : existing.projectId,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : existing.assignedToId,
      });
      const serviceOrder = await tx.serviceOrder.update({
        where: { id, organizationId: session!.user.organizationId },
        data: updateData,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json(serviceOrder);
    });
  } catch (error) {
    const rejection = relationError(error);
    if (rejection) return rejection;
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
    // ✅ Permissão granular: os.delete
    const { allowed, session, errorResponse } = await checkPermission('os', 'delete');
    if (!allowed) return errorResponse!;
    const commercialDenied = await commercialModuleDenial(session!, { module: 'marketing', permission: 'os', action: 'delete' });
    if (commercialDenied) return commercialDenied;

    const { id } = await params;

    return await prisma.$transaction(async (tx) => {
      await lockResource(tx, 'os', id, session!.user.organizationId);
      // Verificar se a OS pertence à organização
      const existing = await tx.serviceOrder.findFirst({
        where: {
          id,
          ...await resourceReadScope(session!.user.organizationId, 'os'),
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
      }

      await validateResourceReferences(tx, session!.user.organizationId, session!.user.id, existing);
      await tx.serviceOrder.delete({ where: { id, organizationId: session!.user.organizationId } });

      return NextResponse.json({ message: 'OS excluída com sucesso' });
    });
  } catch (error) {
    const rejection = relationError(error);
    if (rejection) return rejection;
    console.error('[API OS] Erro ao excluir:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
