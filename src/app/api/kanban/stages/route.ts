import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';

const DEFAULT_STAGES = [
  { key: 'new', title: 'Novo', order: 0, color: 'blue', isDefault: true, isSystem: true },
  { key: 'contacted', title: 'Contactado', order: 1, color: 'yellow', isDefault: true, isSystem: true },
  { key: 'qualified', title: 'Qualificado', order: 2, color: 'orange', isDefault: true, isSystem: true },
  { key: 'proposal', title: 'Proposta', order: 3, color: 'purple', isDefault: true, isSystem: true },
  { key: 'negotiation', title: 'Negociação', order: 4, color: 'yellow', isDefault: true, isSystem: true },
  { key: 'won', title: 'Ganho', order: 5, color: 'green', isDefault: true, isSystem: true },
  { key: 'lost', title: 'Perdido', order: 6, color: 'red', isDefault: true, isSystem: true },
];

function slugifyStage(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function ensureDefaultStages(organizationId: string) {
  const count = await prisma.leadPipelineStage.count({
    where: { organizationId },
  });

  if (count > 0) return;

  await prisma.leadPipelineStage.createMany({
    data: DEFAULT_STAGES.map((stage) => ({
      ...stage,
      organizationId,
    })),
    skipDuplicates: true,
  });
}

export async function GET() {
  try {
    const { allowed, session, errorResponse } = await checkPermission('kanban', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    await ensureDefaultStages(organizationId);

    const stages = await prisma.leadPipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      stages: stages.map((stage) => ({
        id: stage.key,
        title: stage.title,
        order: stage.order,
        color: stage.color,
        isDefault: stage.isDefault,
        isSystem: stage.isSystem,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar etapas do kanban:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('kanban', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const body = await req.json();

    const title = String(body.title || '').trim();
    const color = String(body.color || 'blue').trim();

    if (!title) {
      return NextResponse.json({ error: 'Nome da etapa é obrigatório' }, { status: 400 });
    }

    const baseKey = slugifyStage(title);
    const key = `${baseKey || 'stage'}_${Date.now()}`;

    const lastStage = await prisma.leadPipelineStage.findFirst({
      where: { organizationId },
      orderBy: { order: 'desc' },
    });

    const stage = await prisma.leadPipelineStage.create({
      data: {
        organizationId,
        key,
        title,
        color,
        order: (lastStage?.order ?? -1) + 1,
        isDefault: false,
        isSystem: false,
      },
    });

    return NextResponse.json({
      id: stage.key,
      title: stage.title,
      order: stage.order,
      color: stage.color,
      isDefault: stage.isDefault,
      isSystem: stage.isSystem,
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar etapa do kanban:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}