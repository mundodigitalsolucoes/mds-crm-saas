import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'view');
    if (!allowed) return errorResponse!;

    const { id } = await context.params;
    const organizationId = session!.user.organizationId;

    const tag = await prisma.tag.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error('Erro ao buscar tag:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'edit');
    if (!allowed) return errorResponse!;

    const { id } = await context.params;
    const organizationId = session!.user.organizationId;

    const body = await req.json();

    const existingTag = await prisma.tag.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingTag) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        name:
          typeof body.name === 'string'
            ? body.name.trim()
            : existingTag.name,

        color:
          typeof body.color === 'string'
            ? body.color.trim()
            : existingTag.color,

        category:
          typeof body.category === 'string'
            ? body.category.trim()
            : existingTag.category,

        description:
          typeof body.description === 'string'
            ? body.description.trim()
            : body.description === null
              ? null
              : existingTag.description,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar tag:', error);

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe uma tag com esse nome' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'delete');
    if (!allowed) return errorResponse!;

    const { id } = await context.params;
    const organizationId = session!.user.organizationId;

    const tag = await prisma.tag.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    if (tag.isSystem) {
      return NextResponse.json(
        { error: 'Tags do sistema não podem ser removidas' },
        { status: 403 }
      );
    }

    if (tag._count.leads > 0) {
      await prisma.leadTag.deleteMany({
        where: {
          tagId: tag.id,
        },
      });
    }

    await prisma.tag.delete({
      where: {
        id: tag.id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Erro ao remover tag:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}