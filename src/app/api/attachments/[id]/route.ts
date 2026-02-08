// src/app/api/attachments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';

// DELETE /api/attachments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.organizationId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    // Verificar se pertence à mesma organização
    if (attachment.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Verificar permissão (quem fez upload ou admin)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (attachment.uploadedById !== session.user.id &&
        !['owner', 'admin'].includes(user?.role || '')) {
      return NextResponse.json(
        { error: 'Sem permissão para deletar este anexo' },
        { status: 403 }
      );
    }

    // Deletar arquivo físico
    try {
      const filePath = join(process.cwd(), 'public', attachment.url);
      await unlink(filePath);
    } catch (e) {
      console.warn('Arquivo não encontrado no filesystem:', e);
    }

    // Deletar registro
    await prisma.attachment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar attachment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
