// src/app/api/integrations/meta/status/route.ts
// Verifica status da conexão Meta - requer permissão integrations.view
import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/checkPermission';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // ✅ Permissão granular: integrations.view (ver status)
    const { allowed, session, errorResponse } = await checkPermission('integrations', 'view');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

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
