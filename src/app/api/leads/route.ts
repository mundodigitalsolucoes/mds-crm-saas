import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/leads — Lista leads da organização
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { organizationId } = session.user as any;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 403 });
    }

    // Query params para filtros
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Monta filtro dinâmico
    const where: any = {
      organizationId, // Multi-tenant: SEMPRE filtra por organização
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
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { organizationId, id: userId } = session.user as any;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 403 });
    }

    const body = await req.json();

    // Validação básica
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        company: body.company?.trim() || null,
        position: body.position?.trim() || null,
        source: body.source || 'manual',
        status: body.status || 'new',
        score: body.score || 0,
        value: body.value || null,
        notes: body.notes?.trim() || null,
        assignedToId: body.assignedToId || null,
        createdById: userId,
        utmSource: body.utmSource || null,
        utmMedium: body.utmMedium || null,
        utmCampaign: body.utmCampaign || null,
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
