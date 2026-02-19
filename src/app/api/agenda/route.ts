// src/app/api/agenda/route.ts
// API de Agenda — Listagem e Criação com permissões granulares
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, agendaCreateSchema } from '@/lib/validations';

// Includes padrão para retornar relações
const eventIncludes = {
  lead: {
    select: { id: true, name: true },
  },
  project: {
    select: { id: true, title: true },
  },
  assignedTo: {
    select: { id: true, name: true, avatarUrl: true },
  },
  createdBy: {
    select: { id: true, name: true },
  },
};

// ============================================
// HELPER — Normaliza a data do evento para YYYY-MM-DD
// Evita problemas de timezone (UTC-3 virando dia anterior)
// ============================================
function normalizeEventDate(event: any): any {
  return {
    ...event,
    date: event.date instanceof Date
      ? event.date.toISOString().substring(0, 10)
      : typeof event.date === 'string'
        ? event.date.substring(0, 10)
        : event.date,
  };
}

// ============================================
// HELPER — Cria Date corretamente preservando a data local
// "2026-02-14" → Date que no banco fica 2026-02-14T12:00:00.000Z
// Usando meio-dia UTC para nunca cair no dia anterior/posterior
// ============================================
function parseDateSafe(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00.000Z`);
}

// ============================================
// GET /api/agenda — Listar eventos
// ============================================
export async function GET(request: NextRequest) {
  try {
    // ✅ Permissão granular: agenda.view
    const { allowed, session, errorResponse } = await checkPermission('agenda', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const { searchParams } = new URL(request.url);

    // Filtros
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const leadId = searchParams.get('leadId');
    const projectId = searchParams.get('projectId');
    const assignedToId = searchParams.get('assignedToId');
    const search = searchParams.get('search');

    // Paginação
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Montar filtros dinâmicos
    const where: any = {
      organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (leadId) {
      where.leadId = leadId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    // Filtro por período de datas (usando início e fim do dia em UTC)
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        where.date.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    // Busca por texto
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Buscar eventos e total em paralelo
    const [rawEvents, total] = await Promise.all([
      prisma.agendaEvent.findMany({
        where,
        include: eventIncludes,
        orderBy: [
          { date: 'asc' },
          { startTime: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.agendaEvent.count({ where }),
    ]);

    // Normalizar datas para YYYY-MM-DD antes de enviar ao client
    const events = rawEvents.map(normalizeEventDate);

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API] Erro ao listar eventos da agenda:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ============================================
// POST /api/agenda — Criar evento
// ============================================
export async function POST(request: NextRequest) {
  try {
    // ✅ Permissão granular: agenda.create
    const { allowed, session, errorResponse } = await checkPermission('agenda', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(agendaCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Validar que endTime > startTime (se ambos fornecidos)
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      return NextResponse.json(
        { error: 'Horário de término deve ser após o horário de início' },
        { status: 400 }
      );
    }

    // Validar que leadId pertence à mesma organização (se fornecido)
    if (data.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: data.leadId, organizationId },
      });
      if (!lead) {
        return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
      }
    }

    // Validar que projectId pertence à mesma organização (se fornecido)
    if (data.projectId) {
      const project = await prisma.marketingProject.findFirst({
        where: { id: data.projectId, organizationId },
      });
      if (!project) {
        return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
      }
    }

    // Validar que assignedToId pertence à mesma organização (se fornecido)
    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedToId, organizationId },
      });
      if (!user) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
    }

    const event = await prisma.agendaEvent.create({
      data: {
        organizationId,
        title: data.title,
        description: data.description,
        date: parseDateSafe(data.date), // ✅ Usa meio-dia UTC para evitar shift de timezone
        startTime: data.startTime,
        endTime: data.endTime,
        allDay: data.allDay,
        type: data.type,
        status: data.status,
        color: data.color,
        location: data.location,
        isRecurring: data.isRecurring,
        recurrenceRule: data.recurrenceRule,
        reminderMinutes: data.reminderMinutes,
        leadId: data.leadId,
        projectId: data.projectId,
        assignedToId: data.assignedToId,
        createdById: userId,
      },
      include: eventIncludes,
    });

    // ✅ Normalizar data antes de retornar ao client
    return NextResponse.json(normalizeEventDate(event), { status: 201 });
  } catch (error) {
    console.error('[API] Erro ao criar evento da agenda:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
