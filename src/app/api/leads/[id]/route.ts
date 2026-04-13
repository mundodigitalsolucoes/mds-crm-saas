// src/app/api/leads/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, leadUpdateSchema } from '@/lib/validations';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'view');
    if (!allowed) return errorResponse!;

    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error('Erro ao buscar lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'edit');
    if (!allowed) return errorResponse!;

    const { id } = await params;
    const body = await req.json();

    const parsed = parseBody(leadUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const existing = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.inKanban !== undefined) updateData.inKanban = data.inKanban;
    if (data.score !== undefined) updateData.score = data.score ?? 0;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.productOrService !== undefined) updateData.productOrService = data.productOrService;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.instagram !== undefined) updateData.instagram = data.instagram;
    if (data.facebook !== undefined) updateData.facebook = data.facebook;
    if (data.linkedin !== undefined) updateData.linkedin = data.linkedin;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'delete');
    if (!allowed) return errorResponse!;

    const { id } = await params;

    const existing = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Lead excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}