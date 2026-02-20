// src/app/api/goals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/checkPermission';
import { checkPlanActive } from '@/lib/checkLimits';
import { parseBody, goalCreateSchema } from '@/lib/validations';
import { createNotification } from '@/lib/notify';

// ============================================
// LIMITE DE METAS POR PLANO (sem migration)
// ============================================

const PLAN_GOAL_LIMITS: Record<string, number> = {
  trial:        3,
  starter:      10,
  professional: Infinity,
  enterprise:   Infinity,
};

async function checkGoalLimit(organizationId: string): Promise<{
  allowed: boolean;
  errorResponse: NextResponse | null;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan:   true,
      _count: { select: { goals: true } },
    },
  });

  if (!org) {
    return {
      allowed: false,
      errorResponse: NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      ),
    };
  }

  const slug  = org.plan ?? 'trial';
  const limit = PLAN_GOAL_LIMITS[slug] ?? 3;
  const count = org._count.goals;

  if (count >= limit) {
    return {
      allowed: false,
      errorResponse: NextResponse.json(
        {
          error:   'Limite de metas atingido',
          limit,
          current: count,
          upgrade: true,
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true, errorResponse: null };
}

// ============================================
// GET /api/goals — Listar metas
// ============================================

export async function GET(req: NextRequest) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('goals', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const { searchParams } = new URL(req.url);

    const status   = searchParams.get('status');
    const type     = searchParams.get('type');
    const category = searchParams.get('category');
    const search   = searchParams.get('search');
    const page     = parseInt(searchParams.get('page')  || '1');
    const limit    = parseInt(searchParams.get('limit') || '20');
    const skip     = (page - 1) * limit;

    const where: any = { organizationId };

    if (status)   where.status   = status;
    if (type)     where.type     = type;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          actions:   { orderBy: { position: 'asc' } },
          _count:    { select: { actions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.goal.count({ where }),
    ]);

    return NextResponse.json({
      goals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API] Erro ao listar metas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ============================================
// POST /api/goals — Criar meta
// ============================================

export async function POST(req: NextRequest) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('goals', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId         = session!.user.id;

    // ✅ Verificar plano ativo
    const planCheck = await checkPlanActive(organizationId);
    if (!planCheck.active) return planCheck.errorResponse!;

    // ✅ Verificar limite de metas do plano
    const limitCheck = await checkGoalLimit(organizationId);
    if (!limitCheck.allowed) return limitCheck.errorResponse!;

    const body = await req.json();

    const parsed = parseBody(goalCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const goal = await prisma.goal.create({
      data: {
        organizationId,
        createdById:  userId,
        title:        data.title,
        description:  data.description,
        type:         data.type,
        category:     data.category,
        targetValue:  data.targetValue ?? null,
        unit:         data.unit        ?? null,
        startDate:    data.startDate   ? new Date(data.startDate) : null,
        deadline:     data.deadline    ? new Date(data.deadline)  : null,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        actions:   { orderBy: { position: 'asc' } },
        _count:    { select: { actions: true } },
      },
    });

    // ✅ Notificar criador
    await createNotification({
      userId,
      type:       'goal_created',
      title:      'Meta criada',
      message:    `A meta "${goal.title}" foi criada com sucesso`,
      entityType: 'goal',
      entityId:   goal.id,
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('[API] Erro ao criar meta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
