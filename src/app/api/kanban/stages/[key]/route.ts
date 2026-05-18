import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';

type RouteContext = {
  params: Promise<{
    key: string;
  }>;
};

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('kanban', 'edit');
    if (!allowed) return errorResponse!;

    const { key } = await context.params;
    const organizationId = session!.user.organizationId;
    const body = await req.json();

    const title = typeof body.title === 'string' ? body.title.trim() : undefined;
    const color = typeof body.color === 'string' ? body.color.trim() : undefined;
    const order = typeof body.order === 'number' ? body.order : undefined;

    const existing = await prisma.leadPipelineStage.findFirst({
      where: { organizationId, key },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 });
    }

    const updated = await prisma.leadPipelineStage.update({
      where: { id: existing.id },
      data: {
        ...(title ? { title } : {}),
        ...(color ? { color } : {}),
        ...(order !== undefined ? { order } : {}),
      },
    });

    return NextResponse.json({
      id: updated.key,
      title: updated.title,
      order: updated.order,
      color: updated.color,
      isDefault: updated.isDefault,
      isSystem: updated.isSystem,
    });
  } catch (error) {
    console.error('Erro ao atualizar etapa do kanban:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('kanban', 'delete');
    if (!allowed) return errorResponse!;

    const { key } = await context.params;
    const organizationId = session!.user.organizationId;

    const stage = await prisma.leadPipelineStage.findFirst({
      where: { organizationId, key },
    });

    if (!stage) {
      return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 });
    }

    const hasLeads = await prisma.lead.count({
      where: {
        organizationId,
        status: key,
        inKanban: true,
      },
    });

    if (hasLeads > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir uma etapa com leads no pipeline' },
        { status: 409 }
      );
    }

    await prisma.leadPipelineStage.delete({
      where: { id: stage.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover etapa do kanban:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}