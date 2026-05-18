import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'edit');
    if (!allowed) return errorResponse!;

    const { id } = await context.params;
    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    const body = await req.json();
    const status = String(body.status || '').trim();

    if (!status) {
      return NextResponse.json({ error: 'Status é obrigatório' }, { status: 400 });
    }

    if (status.length > 100) {
      return NextResponse.json(
        { error: 'Status deve ter no máximo 100 caracteres' },
        { status: 400 }
      );
    }

    const existing = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { status },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (existing.status !== status) {
      await prisma.activity.create({
        data: {
          entityType: 'lead',
          entityId: id,
          action: 'stage_changed',
          description: `Lead movido de "${existing.status}" para "${status}"`,
          metadata: JSON.stringify({
            fromStatus: existing.status,
            toStatus: status,
          }),
          userId,
          leadId: id,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar estágio do lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}