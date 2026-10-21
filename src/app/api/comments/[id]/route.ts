// src/app/api/comments/[id]/route.ts
// Atualização e exclusão de comment com permissões granulares dinâmicas
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkAuth, checkPermission } from '@/lib/checkPermission';
import { commercialEntityDenial } from '@/lib/authorization/guards';
import { hasPermission, parsePermissions } from '@/lib/permissions';
import { parseBody, commentUpdateSchema } from '@/lib/validations';
import type { PermissionModule, UserRole } from '@/types/permissions';

// Mapa: entityType → módulo de permissão
const entityTypeToModule: Record<string, PermissionModule> = {
  task: 'tasks',
  lead: 'leads',
  kanban_card: 'tasks',
  goal: 'projects',
};

// PUT /api/comments/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await checkAuth();
    if (!auth.authenticated) return auth.errorResponse!;
    const organizationId = auth.session!.user.organizationId;
    const existingComment = await prisma.comment.findFirst({
      where: { id, organizationId, author: { organizationId } },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.edit
    const permissionModule = entityTypeToModule[existingComment.entityType] || 'tasks';
    const { allowed, session, errorResponse } = await checkPermission(permissionModule, 'edit');
    if (!allowed) return errorResponse!;

    // Verificar autoria — só o autor pode editar seu próprio comentário
    if (existingComment.authorId !== session!.user.id || session!.user.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Você só pode editar seus próprios comentários' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(commentUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const comment = await prisma.$transaction(async tx => {
      const actors = await tx.$queryRaw<{ role: string; permissions: string }[]>(Prisma.sql`
        SELECT u.role, u.permissions FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = ${session!.user.id} AND u.organization_id = ${organizationId}
          AND u.deleted_at IS NULL AND o.deleted_at IS NULL FOR SHARE OF u, o`);
      const actor = actors[0];
      if (!actor) throw new CommentDeleteError(403);
      const rows = await tx.$queryRaw<{ entityType: string; entityId: string; parentId: string | null }[]>(Prisma.sql`
        SELECT entity_type AS "entityType", entity_id AS "entityId", parent_id AS "parentId" FROM comments
        WHERE id = ${id} AND organization_id = ${organizationId} AND author_id = ${session!.user.id} FOR UPDATE`);
      const current = rows[0];
      if (!current || !Object.hasOwn(entityTypeToModule, current.entityType)) throw new CommentDeleteError(404);
      if (actor.role !== 'owner' && !hasPermission(parsePermissions(actor.permissions, actor.role as UserRole), entityTypeToModule[current.entityType], 'edit')) throw new CommentDeleteError(403);
      const commercialDenied = await commercialEntityDenial(tx, session!, current.entityType, current.entityId, 'edit');
      if (commercialDenied) throw new CommentDeleteError(commercialDenied.status);
      if (current.parentId && !await tx.comment.findFirst({ where: {
        id: current.parentId, organizationId, entityType: current.entityType, entityId: current.entityId, author: { organizationId },
      }, select: { id: true } })) throw new CommentDeleteError(409);
      return tx.comment.update({
        where: { id, organizationId, authorId: session!.user.id },
        data: { content: data.content },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    return NextResponse.json({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof CommentDeleteError) return NextResponse.json({ error: 'Recurso indisponível ou não autorizado' }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && (['P2025', 'P2034'].includes(error.code) || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))) return NextResponse.json({ error: 'Conflito de atualização; tente novamente' }, { status: 409 });
    console.error('Erro ao atualizar comment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE errors never disclose foreign identifiers or comment contents.
class CommentDeleteError extends Error {
  constructor(readonly status: number) { super('Comment deletion rejected'); }
}

// DELETE /api/comments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate active membership before looking up any comment, even missing IDs.
    const auth = await checkAuth();
    if (!auth.authenticated) return auth.errorResponse!;
    const { id } = await params;
    const organizationId = auth.session!.user.organizationId;

    return await prisma.$transaction(async tx => {
      const actor = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT u.id FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = ${auth.session!.user.id} AND u.organization_id = ${organizationId}
          AND u.deleted_at IS NULL AND o.deleted_at IS NULL FOR SHARE OF u, o`);
      if (!actor.length) throw new CommentDeleteError(403);

      const roots = await tx.$queryRaw<{
        id: string; entityType: string; entityId: string; authorId: string; parentId: string | null;
      }[]>(Prisma.sql`
        SELECT c.id, c.entity_type AS "entityType", c.entity_id AS "entityId",
          c.author_id AS "authorId", c.parent_id AS "parentId"
        FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.id = ${id} AND c.organization_id = ${organizationId}
          AND u.organization_id = ${organizationId} FOR UPDATE OF c FOR SHARE OF u`);
      const root = roots[0];
      if (!root || !Object.hasOwn(entityTypeToModule, root.entityType)) throw new CommentDeleteError(404);

      const permissionModule = entityTypeToModule[root.entityType];
      const permission = await checkPermission(permissionModule, 'delete');
      if (!permission.allowed) return permission.errorResponse!;
      if (root.authorId !== auth.session!.user.id && !['owner', 'admin'].includes(permission.session!.user.role)) {
        throw new CommentDeleteError(403);
      }

      // A polymorphic entity must also belong to this organization. Lock the ownership
      // chain until commit, including card/column/board for Kanban.
      const tables = { task: Prisma.sql`tasks`, lead: Prisma.sql`leads`, goal: Prisma.sql`goals` };
      const entity = root.entityType === 'kanban_card'
        ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
            SELECT c.id FROM kanban_cards c JOIN kanban_columns col ON col.id = c.column_id
            JOIN kanban_boards b ON b.id = col.board_id
            WHERE c.id = ${root.entityId} AND b.organization_id = ${organizationId} FOR SHARE OF c, col, b`)
        : await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
            SELECT id FROM ${tables[root.entityType as keyof typeof tables]}
            WHERE id = ${root.entityId} AND organization_id = ${organizationId} FOR SHARE`);
      if (!entity.length) throw new CommentDeleteError(404);
      const commercialDenied = await commercialEntityDenial(tx, auth.session!, root.entityType, root.entityId, 'delete');
      if (commercialDenied) throw new CommentDeleteError(commercialDenied.status);

      const scope = { organizationId, entityType: root.entityType, entityId: root.entityId, author: { organizationId } };
      if (root.parentId && !await tx.comment.findFirst({ where: { ...scope, id: root.parentId }, select: { id: true } })) {
        throw new CommentDeleteError(409);
      }

      // Reject corrupt edges without touching either tenant. Discover/lock all local
      // descendants, so legitimate nested replies are not left orphaned.
      const ids = new Set([id]);
      let frontier = [id];
      while (frontier.length) {
        const parentId = { in: frontier };
        if (await tx.comment.count({ where: { parentId, NOT: scope } })) throw new CommentDeleteError(409);
        const children = await tx.comment.findMany({ where: { ...scope, parentId }, select: { id: true } });
        if (!children.length) break;
        if (children.some(child => ids.has(child.id))) throw new CommentDeleteError(409);
        frontier = children.map(child => child.id);
        const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT c.id FROM comments c JOIN users u ON u.id = c.author_id
          WHERE c.id IN (${Prisma.join(frontier)}) AND c.organization_id = ${organizationId}
            AND c.entity_type = ${root.entityType} AND c.entity_id = ${root.entityId}
            AND u.organization_id = ${organizationId} ORDER BY c.id
          FOR UPDATE OF c FOR SHARE OF u`);
        if (locked.length !== frontier.length) throw new CommentDeleteError(409);
        frontier.forEach(childId => ids.add(childId));
      }
      const deleted = await tx.comment.deleteMany({ where: { ...scope, id: { in: [...ids] } } });
      if (deleted.count !== ids.size) throw new CommentDeleteError(409);
      return NextResponse.json({ success: true });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    if (error instanceof CommentDeleteError) {
      const message = error.status === 404 ? 'Comentário não encontrado'
        : error.status === 403 ? 'Sem permissão para deletar este comentário' : 'Relação de comentário indisponível';
      return NextResponse.json({ error: message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (['P2025', 'P2034'].includes(error.code) || (error.code === 'P2010' && ['40P01', '40001'].includes(String(error.meta?.code))))) {
      return NextResponse.json({ error: 'Conflito de atualização; tente novamente' }, { status: 409 });
    }
    console.error('Erro ao deletar comment:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
