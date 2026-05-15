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

    const { id: leadId } = await context.params;
    const organizationId = session!.user.organizationId;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const tags = await prisma.leadTag.findMany({
      where: { leadId },
      include: { tag: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      tags: tags.map((item) => item.tag),
    });
  } catch (error) {
    console.error('Erro ao buscar tags do lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'edit');
    if (!allowed) return errorResponse!;

    const { id: leadId } = await context.params;
    const organizationId = session!.user.organizationId;
    const body = await req.json();

    const tagId = String(body.tagId || '').trim();

    if (!tagId) {
      return NextResponse.json({ error: 'tagId é obrigatório' }, { status: 400 });
    }

    const [lead, tag] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: leadId, organizationId },
        select: { id: true },
      }),
      prisma.tag.findFirst({
        where: { id: tagId, organizationId },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    if (!tag) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    const leadTag = await prisma.leadTag.upsert({
      where: {
        leadId_tagId: {
          leadId,
          tagId,
        },
      },
      update: {},
      create: {
        leadId,
        tagId,
      },
      include: {
        tag: true,
      },
    });

    await prisma.activity.create({
      data: {
        entityType: 'lead',
        entityId: leadId,
        action: 'tag_added',
        description: `Tag "${tag.name}" adicionada ao lead`,
        metadata: JSON.stringify({
          tagId: tag.id,
          tagName: tag.name,
          tagSlug: tag.slug,
        }),
        userId: session!.user.id,
        leadId,
      },
    });

    return NextResponse.json(leadTag.tag, { status: 201 });
  } catch (error) {
    console.error('Erro ao adicionar tag ao lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'edit');
    if (!allowed) return errorResponse!;

    const { id: leadId } = await context.params;
    const organizationId = session!.user.organizationId;

    const { searchParams } = new URL(req.url);
    const tagId = String(searchParams.get('tagId') || '').trim();

    if (!tagId) {
      return NextResponse.json({ error: 'tagId é obrigatório' }, { status: 400 });
    }

    const [lead, tag] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: leadId, organizationId },
        select: { id: true },
      }),
      prisma.tag.findFirst({
        where: { id: tagId, organizationId },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    if (!tag) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    await prisma.leadTag.deleteMany({
      where: {
        leadId,
        tagId,
      },
    });

    await prisma.activity.create({
      data: {
        entityType: 'lead',
        entityId: leadId,
        action: 'tag_removed',
        description: `Tag "${tag.name}" removida do lead`,
        metadata: JSON.stringify({
          tagId: tag.id,
          tagName: tag.name,
          tagSlug: tag.slug,
        }),
        userId: session!.user.id,
        leadId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover tag do lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}