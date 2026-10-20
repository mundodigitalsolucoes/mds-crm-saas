// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/checkPermission';

// GET /api/notifications
export async function GET(request: NextRequest) {
  try {
    const authentication = await checkAuth();
    if (!authentication.authenticated || !authentication.session) return authentication.errorResponse!;
    const session = authentication.session;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = { userId: session.user.id };
    if (unreadOnly) {
      where.read = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map(n => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString(),
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('Erro ao buscar notifications:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
