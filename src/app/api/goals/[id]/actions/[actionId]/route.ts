// src/app/api/goals/[id]/actions/[actionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, goalActionUpdateSchema } from '@/lib/validations';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('goals', 'edit');
    if (!allowed) return errorResponse!;

    const { id, actionId } = await params;
    const organizationId = session!.user.organizationId;

    const goal = await prisma.goal.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    const existing = await prisma.goalAction.findFirst({
      where: { id: actionId, goalId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
    }

    const body = await req.json();

    const parsed = parseBody(goalActionUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const completedAt =
      data.completed === true  && !existing.completed ? new Date() :
      data.completed === false && existing.completed  ? null        :
      undefined;

    const action = await prisma.goalAction.update({
      where: { id: actionId },
      data: {
        ...(data.title       !== undefined && { title:       data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.completed   !== undefined && { completed:   data.completed }),
        ...(data.position    !== undefined && { position:    data.position }),
        ...(completedAt      !== undefined && { completedAt }),
      },
    });

    return NextResponse.json(action);
  } catch (error) {
    console.error('[API] Erro ao atualizar ação da meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('goals', 'delete');
    if (!allowed) return errorResponse!;

    const { id, actionId } = await params;
    const organizationId = session!.user.organizationId;

    const goal = await prisma.goal.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    const existing = await prisma.goalAction.findFirst({
      where: { id: actionId, goalId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
    }

    await prisma.goalAction.delete({ where: { id: actionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Erro ao excluir ação da meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
