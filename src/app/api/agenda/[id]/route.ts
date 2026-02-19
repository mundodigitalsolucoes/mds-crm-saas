// src/app/api/agenda/[id]/route.ts
// Detalhe, atualização e exclusão de evento com permissões granulares
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, agendaUpdateSchema } from '@/lib/validations';

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
    // ✅ Permissão granular: agenda.view
    const { allowed, session, errorResponse } = await checkPermission('agenda', 'view');
    if (!allowed) return errorResponse!;

    const { id } = await params;

    const event = await prisma.agendaEvent.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
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
    // ✅ Permissão granular: agenda.edit
    const { allowed, session, errorResponse } = await checkPermission('agenda', 'edit');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const { id } = await params;

    // Verificar se o evento existe e pertence à organização
    const existing = await prisma.agendaEvent.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(agendaUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

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
        where: { id: data.leadId, organizationId },
      });
      if (!lead) {
        return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
      }
    }

    // Validar projectId se fornecido
    if (data.projectId) {
      const project = await prisma.marketingProject.findFirst({
        where: { id: data.projectId, organizationId },
      });
      if (!project) {
        return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
      }
    }

    // Validar assignedToId se fornecido
    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedToId, organizationId },
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
    // ✅ Permissão granular: agenda.delete
    const { allowed, session, errorResponse } = await checkPermission('agenda', 'delete');
    if (!allowed) return errorResponse!;

    const { id } = await params;

    // Verificar se o evento existe e pertence à organização
    const existing = await prisma.agendaEvent.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
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
