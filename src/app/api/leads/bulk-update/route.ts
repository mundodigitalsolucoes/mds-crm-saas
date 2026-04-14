import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody } from '@/lib/validations';

const leadStatusEnum = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
]);

const bulkUpdateSchema = z
  .object({
    ids: z
      .array(z.string().uuid('ID de lead inválido'))
      .min(1, 'Selecione pelo menos 1 lead')
      .max(500, 'Máximo de 500 leads por operação'),
    action: z.enum(['setInKanban', 'setStatus']),
    inKanban: z.boolean().optional(),
    status: leadStatusEnum.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'setInKanban' && typeof data.inKanban !== 'boolean') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'inKanban é obrigatório para ação setInKanban',
        path: ['inKanban'],
      });
    }

    if (data.action === 'setStatus' && !data.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'status é obrigatório para ação setStatus',
        path: ['status'],
      });
    }
  });

export async function POST(req: NextRequest) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'edit');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const body = await req.json();

    const parsed = parseBody(bulkUpdateSchema, body);
    if (!parsed.success) return parsed.response;

    const { ids, action, inKanban, status } = parsed.data;

    const existingLeads = await prisma.lead.findMany({
      where: {
        organizationId,
        id: { in: ids },
      },
      select: { id: true },
    });

    if (existingLeads.length !== ids.length) {
      return NextResponse.json(
        { error: 'Um ou mais leads não foram encontrados ou não pertencem à sua organização' },
        { status: 400 }
      );
    }

    const dataToUpdate: Record<string, any> = {};

    if (action === 'setInKanban') {
      dataToUpdate.inKanban = inKanban;
    }

    if (action === 'setStatus') {
      dataToUpdate.status = status;
    }

    const result = await prisma.lead.updateMany({
      where: {
        organizationId,
        id: { in: ids },
      },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message:
        action === 'setInKanban'
          ? `${result.count} lead(s) atualizado(s) no pipeline`
          : `${result.count} lead(s) tiveram o status atualizado`,
    });
  } catch (error) {
    console.error('Erro ao atualizar leads em massa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}