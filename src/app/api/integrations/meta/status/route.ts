import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = (session.user as any).organizationId;

    const connection = await prisma.connectedAccount.findUnique({
      where: {
        provider_organizationId: {
          provider: 'meta',
          organizationId,
        },
      },
      include: {
        connectedBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    const connectionData = JSON.parse(connection.data || '{}');
    const isExpired = connection.expiresAt && new Date() > connection.expiresAt;

    return NextResponse.json({
      connected: true,
      expired: isExpired,
      expiresAt: connection.expiresAt,
      connectedBy: connection.connectedBy,
      connectedAt: connectionData.connectedAt,
      adAccounts: connectionData.adAccounts || [],
      selectedAdAccountId: connectionData.selectedAdAccountId,
      selectedAdAccountName: connectionData.selectedAdAccountName,
    });
  } catch (error) {
    console.error('Erro ao verificar status Meta:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
