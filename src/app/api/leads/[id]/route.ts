import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkModulePermission } from '@/lib/authorization/guards';
import { parseBody, leadUpdateSchema } from '@/lib/validations';
import { isTenantLeadAssignee, isTenantLeadStatus } from '@/lib/leads/tenant-relations';

const LEAD_UPDATE_ALLOWED_KEYS = [
  'name',
  'email',
  'phone',
  'whatsapp',
  'company',
  'position',
  'source',
  'status',
  'inKanban',
  'score',
  'value',
  'productOrService',
  'city',
  'website',
  'instagram',
  'facebook',
  'linkedin',
  'notes',
  'assignedToId',
];

function sanitizeLeadUpdateBody(body: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => LEAD_UPDATE_ALLOWED_KEYS.includes(key))
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed, session, errorResponse } = await checkModulePermission({ module: 'vendas', permission: 'leads', action: 'view' });
    if (!allowed) return errorResponse!;

    const { id } = await params;
    const organizationId = session!.user.organizationId;

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: session!.user.organizationId,
      },
      include: {
        assignedTo: { where: { organizationId }, select: { id: true, name: true, email: true } },
        createdBy: { where: { organizationId }, select: { id: true, name: true } },
        tasks: {
          where: { organizationId: session!.user.organizationId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        chatwootConversations: {
          where: { organizationId: session!.user.organizationId },
          orderBy: { lastMessageAt: 'desc' },
          take: 5,
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
    const { allowed, session, errorResponse } = await checkModulePermission({ module: 'vendas', permission: 'leads', action: 'edit' });
    if (!allowed) return errorResponse!;

    const { id } = await params;
    const body = await req.json();

    const cleanBody = sanitizeLeadUpdateBody(body);

    const result = leadUpdateSchema.safeParse(cleanBody);

if (!result.success) {
  return NextResponse.json(
    {
      error: 'Dados inválidos',
      details: result.error.flatten().fieldErrors,
    },
    { status: 400 }
  );
}

    const data = result.data;
    const organizationId = session!.user.organizationId;
    const userId = session!.user.id;

    const existing = await prisma.lead.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    function normalizeLeadStatus(status: string) {
  const normalized = status.trim().toLowerCase();

  const systemStatusMap: Record<string, string> = {
    'novo lead': 'new',
    'novo': 'new',
    'lead novo': 'new',

    'em contato': 'contact',
    'contato': 'contact',

    'proposta enviada': 'proposal',
    'proposta': 'proposal',

    'fechado': 'closed',
    'ganho': 'closed',

    'perdido': 'lost',
  };

  return systemStatusMap[normalized] || status;
}

if (data.name !== undefined) updateData.name = data.name;
if (data.email !== undefined) updateData.email = data.email;
if (data.phone !== undefined) updateData.phone = data.phone;
if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
if (data.company !== undefined) updateData.company = data.company;
if (data.position !== undefined) updateData.position = data.position;
if (data.source !== undefined) updateData.source = data.source;

if (data.status !== undefined) {
  updateData.status = normalizeLeadStatus(data.status);
}

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

    if (!await isTenantLeadAssignee(organizationId, data.assignedToId)) {
      return NextResponse.json({ error: 'Responsável inválido para esta organização' }, { status: 400 });
    }
    if (!await isTenantLeadStatus(organizationId, updateData.status)) {
      return NextResponse.json({ error: 'Etapa inválida para esta organização' }, { status: 400 });
    }

    const changedFields = Object.keys(updateData).filter((key) => {
      const beforeValue = (existing as any)[key];
      const afterValue = updateData[key];

      if (beforeValue instanceof Date || afterValue instanceof Date) {
        return String(beforeValue) !== String(afterValue);
      }

      return beforeValue !== afterValue;
    });

    const updated = await prisma.lead.update({
      where: { id, organizationId },
      data: updateData,
      include: {
        assignedTo: { where: { organizationId }, select: { id: true, name: true, email: true } },
        createdBy: { where: { organizationId }, select: { id: true, name: true } },
      },
    });

    if (changedFields.length > 0) {
      await prisma.activity.create({
        data: {
          entityType: 'lead',
          entityId: id,
          action: 'lead_updated',
          description: `Lead atualizado: ${changedFields.join(', ')}`,
          metadata: JSON.stringify({
            changedFields,
          }),
          userId,
          leadId: id,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed, session, errorResponse } = await checkModulePermission({ module: 'vendas', permission: 'leads', action: 'delete' });
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

    await prisma.lead.delete({ where: { id, organizationId: session!.user.organizationId } });

    return NextResponse.json({ success: true, message: 'Lead excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir lead:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
