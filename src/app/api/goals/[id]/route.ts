// src/app/api/goals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, goalUpdateSchema } from '@/lib/validations';
import { createNotification } from '@/lib/notify';

const goalIncludes = {
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
  actions:   { orderBy: { position: 'asc' } as const },
  _count:    { select: { actions: true } },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('goals', 'view');
    if (!allowed) return errorResponse!;

    const { id } = await params;
    const organizationId = session!.user.organizationId;

    const goal = await prisma.goal.findFirst({
      where: { id, organizationId },
      include: goalIncludes,
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error('[API] Erro ao buscar meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('goals', 'edit');
    if (!allowed) return errorResponse!;

    const { id } = await params;
    const organizationId = session!.user.organizationId;
    const userId         = session!.user.id;

    const existing = await prisma.goal.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    const body = await req.json();

    const parsed = parseBody(goalUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const completedAt =
      data.status === 'completed' && existing.status !== 'completed'
        ? new Date()
        : data.status !== 'completed'
        ? null
        : undefined;

    const goal = await prisma.goal.update({
      where: { id },
      // src/app/api/goals/[id]/route.ts
// Substitui APENAS o bloco data: { ... } do prisma.goal.update (linha ~83)

      data: {
        ...(data.title        !== undefined && { title:        data.title }),
        ...(data.description  !== undefined && { description:  data.description }),
        ...(data.type         !== undefined && { type:         data.type }),
        ...(data.category     !== undefined && { category:     data.category }),
        ...(data.status       !== undefined && { status:       data.status }),
        ...(data.targetValue  !== undefined && { targetValue:  data.targetValue ?? null }),
        // currentValue nunca pode ser null (Decimal @default(0) não nullable)
        ...(data.currentValue !== undefined && data.currentValue !== null && {
          currentValue: data.currentValue,
        }),
        ...(data.unit         !== undefined && { unit:         data.unit }),
        ...(data.startDate    !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.deadline     !== undefined && {
          deadline: data.deadline ? new Date(data.deadline) : null,
        }),
        ...(completedAt !== undefined && { completedAt }),
      },
      include: goalIncludes,
    });

    if (data.status === 'completed' && existing.status !== 'completed') {
      await createNotification({
        userId,
        type:       'goal_completed',
        title:      'Meta concluída! 🎉',
        message:    `A meta "${goal.title}" foi marcada como concluída`,
        entityType: 'goal',
        entityId:   goal.id,
      });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error('[API] Erro ao atualizar meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('goals', 'delete');
    if (!allowed) return errorResponse!;

    const { id } = await params;
    const organizationId = session!.user.organizationId;

    const existing = await prisma.goal.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    await prisma.goal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Erro ao excluir meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
