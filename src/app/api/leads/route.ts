// src/app/api/leads/route.ts
// CRUD de leads com rate limiting, permissões granulares, limites de plano e multi-tenant
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/checkPermission';
import { checkOrganizationLimit, checkPlanActive } from '@/lib/checkLimits';
import { parseBody, leadCreateSchema } from '@/lib/validations';

// GET /api/leads — Lista leads da organização
export async function GET(req: NextRequest) {
  try {
    // Rate limiting: 60 req/min por IP
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    // ✅ Permissão granular: leads.view
    const { allowed, session, errorResponse } = await checkPermission('leads', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    // Query params para filtros
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Monta filtro dinâmico
    const where: any = {
      organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      leads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/leads — Cria um novo lead
export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 60 req/min por IP
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    // ✅ Permissão granular: leads.create
    const { allowed, session, errorResponse } = await checkPermission('leads', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    // ✅ Verificar se plano está ativo
    const planCheck = await checkPlanActive(organizationId);
    if (!planCheck.active) return planCheck.errorResponse!;

    // ✅ Verificar limite de leads do plano
    const limitCheck = await checkOrganizationLimit(organizationId, 'leads');
    if (!limitCheck.allowed) return limitCheck.errorResponse!;

    const body = await req.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(leadCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        position: data.position,
        source: data.source,
        status: data.status,
        score: data.score as number,
        value: data.value,
        notes: data.notes,
        assignedToId: data.assignedToId,
        createdById: userId,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        utmContent: data.utmContent ?? null,
        utmTerm: data.utmTerm ?? null,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
