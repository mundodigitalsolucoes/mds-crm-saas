// src/app/api/attachments/[id]/route.ts
// Exclusão de attachment com permissão granular dinâmica por entityType
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { commercialEntityDenial } from '@/lib/authorization/guards';
import { checkAuth, checkPermission } from '@/lib/checkPermission';
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

    const auth = await checkAuth();
    if (!auth.authenticated) return auth.errorResponse!;
    const organizationId = auth.session!.user.organizationId;
    const attachment = await prisma.attachment.findFirst({
      where: { id, organizationId, uploadedBy: { organizationId } },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.delete
    const permissionModule = entityTypeToModule[attachment.entityType] || 'tasks';
    const { allowed, session, errorResponse } = await checkPermission(permissionModule, 'delete');
    if (!allowed) return errorResponse!;

    // Verificar se pertence à mesma organização
    if (attachment.organizationId !== session!.user.organizationId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const deletedUrl = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ entityType: string; entityId: string; uploadedById: string; url: string }[]>(Prisma.sql`
        SELECT a.entity_type AS "entityType", a.entity_id AS "entityId", a.uploaded_by AS "uploadedById", a.url
        FROM attachments a JOIN users u ON u.id = a.uploaded_by
        WHERE a.id = ${id} AND a.organization_id = ${organizationId}
          AND u.organization_id = ${organizationId} FOR UPDATE OF a FOR SHARE OF u`);
      const current = rows[0];
      if (!current) throw new AttachmentDeleteError(404);
      const denied = await commercialEntityDenial(tx, session!, current.entityType, current.entityId, 'delete');
      if (denied) throw new AttachmentDeleteError(denied.status);
      const actor = await tx.user.findUnique({ where: { id: session!.user.id }, select: { role: true } });
      if (current.uploadedById !== session!.user.id && !['owner', 'admin'].includes(actor?.role || '')) throw new AttachmentDeleteError(403);
      await tx.attachment.delete({ where: { id, organizationId, uploadedById: current.uploadedById } });
      return current.url;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    // Only a committed, authorized deletion may touch the filesystem.
    try {
      const prefix = `/uploads/${organizationId}/`;
      const filename = deletedUrl.startsWith(prefix) ? deletedUrl.slice(prefix.length) : '';
      if (filename && /^[A-Za-z0-9._-]+$/.test(filename) && !filename.includes('..')) await unlink(join(process.cwd(), 'public', 'uploads', organizationId, filename));
    } catch {
      console.warn('Arquivo do anexo não removido do filesystem');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AttachmentDeleteError) return NextResponse.json({ error: 'Recurso indisponível ou não autorizado' }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && (['P2025', 'P2034'].includes(error.code) || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))) return NextResponse.json({ error: 'Conflito de atualização; tente novamente' }, { status: 409 });
    console.error('Erro ao deletar attachment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

class AttachmentDeleteError extends Error {
  constructor(readonly status: number) { super('Attachment deletion rejected'); }
}
