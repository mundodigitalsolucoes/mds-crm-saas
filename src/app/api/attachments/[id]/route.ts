// src/app/api/attachments/[id]/route.ts
// Exclusão de attachment com permissão granular dinâmica por entityType
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { unlink } from 'fs/promises';
import { join } from 'path';
import type { PermissionModule } from '@/types/permissions';

// Mapa: entityType → módulo de permissão
const entityTypeToModule: Record<string, PermissionModule> = {
  task: 'tasks',
  lead: 'leads',
  kanban_card: 'tasks',
  goal: 'projects',
  comment: 'tasks',
};

// DELETE /api/attachments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Buscar o attachment primeiro para saber o entityType
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.delete
    const module = entityTypeToModule[attachment.entityType] || 'tasks';
    const { allowed, session, errorResponse } = await checkPermission(module, 'delete');
    if (!allowed) return errorResponse!;

    // Verificar se pertence à mesma organização
    if (attachment.organizationId !== session!.user.organizationId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Verificar autoria — autor pode deletar, owner/admin também (via permissão delete já concedida)
    if (attachment.uploadedById !== session!.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session!.user.id },
        select: { role: true },
      });

      if (!['owner', 'admin'].includes(user?.role || '')) {
        return NextResponse.json(
          { error: 'Sem permissão para deletar este anexo' },
          { status: 403 }
        );
      }
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
