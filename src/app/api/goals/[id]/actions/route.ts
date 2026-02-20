// src/app/api/goals/[id]/actions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, goalActionCreateSchema } from '@/lib/validations';

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
      select: { id: true },
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    const actions = await prisma.goalAction.findMany({
      where:   { goalId: id },
      orderBy: { position: 'asc' },
    });

    return NextResponse.json(actions);
  } catch (error) {
    console.error('[API] Erro ao listar ações da meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(
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

    const goal = await prisma.goal.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    const body = await req.json();

    const parsed = parseBody(goalActionCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    let position = data.position;
    if (position === undefined) {
      const last = await prisma.goalAction.findFirst({
        where:   { goalId: id },
        orderBy: { position: 'desc' },
        select:  { position: true },
      });
      position = (last?.position ?? -1) + 1;
    }

    const action = await prisma.goalAction.create({
      data: {
        goalId:      id,
        title:       data.title,
        description: data.description,
        position,
      },
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    console.error('[API] Erro ao criar ação da meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
