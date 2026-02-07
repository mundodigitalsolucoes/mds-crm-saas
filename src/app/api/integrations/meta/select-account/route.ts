import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = (session.user as any).organizationId;
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
