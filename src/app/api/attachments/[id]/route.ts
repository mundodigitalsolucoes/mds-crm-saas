// src/app/api/attachments/[id]/route.ts
// Exclusão de attachment com permissão granular dinâmica por entityType
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { commercialEntityDenial } from '@/lib/authorization/guards';
import { checkAuth, checkPermission } from '@/lib/checkPermission';
import { readAttachment, removePrivateAttachment, attachmentHeaders, AttachmentStorageError } from '@/lib/attachments/storage';
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

    const deletedFile = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ entityType: string; entityId: string; uploadedById: string; url: string; filename: string }[]>(Prisma.sql`
        SELECT a.entity_type AS "entityType", a.entity_id AS "entityId", a.uploaded_by AS "uploadedById", a.url, a.filename
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
      return { id, organizationId, url: current.url, filename: current.filename };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    // Only a committed, authorized deletion may touch the filesystem.
    try {
      await removePrivateAttachment(deletedFile);
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


// Authenticated bytes only; no public redirect, conditional304 or unauthenticated range shortcut.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await checkAuth();
    if (!auth.authenticated) {
      auth.errorResponse!.headers.set('Cache-Control', 'private, no-store');
      auth.errorResponse!.headers.set('Vary', 'Cookie');
      auth.errorResponse!.headers.set('X-Content-Type-Options', 'nosniff');
      return auth.errorResponse!;
    }
    const { id } = await params;
    const organizationId = auth.session!.user.organizationId;
    const result = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string; entityType: string; entityId: string; filename: string; url: string; originalName: string }[]>(Prisma.sql`
        SELECT a.id, a.entity_type AS "entityType", a.entity_id AS "entityId", a.filename, a.url, a.original_name AS "originalName"
        FROM attachments a JOIN users u ON u.id = a.uploaded_by
        WHERE a.id = ${id} AND a.organization_id = ${organizationId}
          AND u.organization_id = ${organizationId} FOR SHARE OF a, u`);
      const file = rows[0];
      if (!file) throw new AttachmentDeleteError(404);
      const denied = await commercialEntityDenial(tx, auth.session!, file.entityType, file.entityId, 'view');
      if (denied) throw new AttachmentDeleteError(denied.status);
      const bytes = await readAttachment({ ...file, organizationId });
      return { bytes, originalName: file.originalName };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    // Range and validators never bypass authorization; authenticated requests receive the full bounded file.
    return new NextResponse(new Uint8Array(result.bytes), { status: 200, headers: attachmentHeaders(result.bytes, result.originalName) });
  } catch (error) {
    const status = error instanceof AttachmentDeleteError || error instanceof AttachmentStorageError ? error.status : 500;
    return NextResponse.json({ error: 'Arquivo indisponível' }, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' } });
  }
}
