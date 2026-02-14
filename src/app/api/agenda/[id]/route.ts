// src/app/api/agenda/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema de validação para atualização
const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  allDay: z.boolean().optional(),
  type: z.enum(['meeting', 'call', 'follow_up', 'reminder', 'deadline', 'other']).optional(),
  status: z.enum(['agendado', 'concluido', 'cancelado']).optional(),
  color: z.string().max(20).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

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
// GET /api/agenda/[id] — Buscar evento por ID
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.agendaEvent.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: eventIncludes,
    });

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('[API] Erro ao buscar evento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ============================================
// PUT /api/agenda/[id] — Atualizar evento
// ============================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se o evento existe e pertence à organização
    const existing = await prisma.agendaEvent.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validar horários
    const finalStartTime = data.startTime !== undefined ? data.startTime : existing.startTime;
    const finalEndTime = data.endTime !== undefined ? data.endTime : existing.endTime;
    if (finalStartTime && finalEndTime && finalEndTime <= finalStartTime) {
      return NextResponse.json(
        { error: 'Horário de término deve ser após o horário de início' },
        { status: 400 }
      );
    }

    // Validar leadId se fornecido
    if (data.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: data.leadId, organizationId: session.user.organizationId },
      });
      if (!lead) {
        return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
      }
    }

    // Validar projectId se fornecido
    if (data.projectId) {
      const project = await prisma.marketingProject.findFirst({
        where: { id: data.projectId, organizationId: session.user.organizationId },
      });
      if (!project) {
        return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
      }
    }

    // Validar assignedToId se fornecido
    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedToId, organizationId: session.user.organizationId },
      });
      if (!user) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
    }

    // Montar objeto de atualização
    const updateData: any = { ...data };
    if (data.date) {
      updateData.date = new Date(data.date);
    }

    const event = await prisma.agendaEvent.update({
      where: { id },
      data: updateData,
      include: eventIncludes,
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('[API] Erro ao atualizar evento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ============================================
// DELETE /api/agenda/[id] — Excluir evento
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se o evento existe e pertence à organização
    const existing = await prisma.agendaEvent.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    await prisma.agendaEvent.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Evento excluído com sucesso' });
  } catch (error) {
    console.error('[API] Erro ao excluir evento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
