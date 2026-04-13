import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody } from '@/lib/validations';

const bulkDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid('ID de lead inválido'))
    .min(1, 'Selecione pelo menos 1 lead')
    .max(500, 'Máximo de 500 leads por operação'),
  confirmationText: z.literal('EXCLUIR', {
    errorMap: () => ({ message: 'Texto de confirmação inválido' }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'delete');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const body = await req.json();

    const parsed = parseBody(bulkDeleteSchema, body);
    if (!parsed.success) return parsed.response;

    const { ids } = parsed.data;

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

    const result = await prisma.lead.deleteMany({
      where: {
        organizationId,
        id: { in: ids },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `${result.count} lead(s) excluído(s) com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao excluir leads em massa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}