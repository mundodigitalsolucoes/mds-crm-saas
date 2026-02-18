// src/app/api/integrations/meta/select-account/route.ts
// Seleciona conta de anúncios Meta - requer permissão integrations.edit
import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/checkPermission';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // ✅ Permissão granular: integrations.edit (configurar conta)
    const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;
    const body = await req.json();
    const { adAccountId, adAccountName } = body;

    if (!adAccountId) {
      return NextResponse.json({ error: 'adAccountId é obrigatório' }, { status: 400 });
    }

    const connection = await prisma.connectedAccount.findUnique({
      where: {
        provider_organizationId: {
          provider: 'meta',
          organizationId,
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Meta não conectado' }, { status: 404 });
    }

    const currentData = JSON.parse(connection.data || '{}');
    const newData = {
      ...currentData,
      selectedAdAccountId: adAccountId,
      selectedAdAccountName: adAccountName || '',
    };

    await prisma.connectedAccount.update({
      where: { id: connection.id },
      data: {
        data: JSON.stringify(newData),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao selecionar conta:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
