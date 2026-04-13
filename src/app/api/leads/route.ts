// src/app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/checkPermission';
import { checkOrganizationLimit, checkPlanActive } from '@/lib/checkLimits';
import { parseBody, leadCreateSchema } from '@/lib/validations';
import { createNotification } from '@/lib/notify';

export async function GET(req: NextRequest) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('leads', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { whatsapp: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { productOrService: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
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

export async function POST(req: NextRequest) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { allowed, session, errorResponse } = await checkPermission('leads', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    const planCheck = await checkPlanActive(organizationId);
    if (!planCheck.active) return planCheck.errorResponse!;

    const limitCheck = await checkOrganizationLimit(organizationId, 'leads');
    if (!limitCheck.allowed) return limitCheck.errorResponse!;

    const body = await req.json();
    const parsed = parseBody(leadCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        whatsapp: data.whatsapp,
        company: data.company,
        position: data.position,
        source: data.source,
        status: data.status,
        inKanban: data.inKanban,
        score: data.score as number,
        value: data.value,
        productOrService: data.productOrService,
        city: data.city,
        website: data.website,
        instagram: data.instagram,
        facebook: data.facebook,
        linkedin: data.linkedin,
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

    if (data.assignedToId && data.assignedToId !== userId) {
      await createNotification({
        userId: data.assignedToId,
        type: 'lead_assigned',
        title: 'Novo lead atribuído',
        message: `O lead "${lead.name}" foi atribuído a você`,
        entityType: 'lead',
        entityId: lead.id,
      });
    }

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}