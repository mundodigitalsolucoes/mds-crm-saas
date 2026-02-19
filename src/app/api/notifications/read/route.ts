// src/app/api/notifications/read/route.ts
// Marcar notificações como lidas — usa session sem permissão de módulo (recurso pessoal do usuário)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseBody, notificationMarkReadSchema } from '@/lib/validations';

// POST /api/notifications/read
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // ✅ Validação Zod centralizada (refine: all=true OU ids[].length > 0)
    const parsed = parseBody(notificationMarkReadSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const now = new Date();

    if (data.all) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true, readAt: now },
      });
    } else if (data.ids && data.ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: data.ids },
          userId: session.user.id,
        },
        data: { read: true, readAt: now },
      });
    }

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    });

    return NextResponse.json({ success: true, unreadCount });
  } catch (error) {
    console.error('Erro ao marcar notifications:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
