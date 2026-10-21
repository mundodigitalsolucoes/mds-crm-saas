// src/app/api/comments/route.ts
// API de Comments — Listagem e Criação com permissões granulares dinâmicas por entityType
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, commentCreateSchema, commentEntityTypeEnum } from '@/lib/validations';
import type { PermissionModule } from '@/types/permissions';

// Mapa: entityType → módulo de permissão
const entityTypeToModule: Record<string, PermissionModule> = {
  task: 'tasks',
  lead: 'leads',
  kanban_card: 'tasks',
  goal: 'projects',
};

// Keep polymorphic references scoped without adding another authorization mechanism.
class InvalidCommentReference extends Error {
  constructor(readonly status: number = 400) { super('Referência indisponível ou não autorizada'); }
}

async function lockEntity(tx: Prisma.TransactionClient, entityType: string, entityId: string, organizationId: string) {
  const tables = { task: Prisma.sql`tasks`, lead: Prisma.sql`leads`, goal: Prisma.sql`goals` };
  const rows = entityType === 'kanban_card'
    ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT c.id FROM kanban_cards c
        JOIN kanban_columns col ON col.id = c.column_id
        JOIN kanban_boards b ON b.id = col.board_id
        WHERE c.id = ${entityId} AND b.organization_id = ${organizationId}
        FOR SHARE OF c, col, b`)
    : await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM ${tables[entityType as keyof typeof tables]}
        WHERE id = ${entityId} AND organization_id = ${organizationId} FOR SHARE`);
  if (!rows.length) throw new InvalidCommentReference(404);
}

function referenceError(error: unknown) {
  if (error instanceof InvalidCommentReference) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2025', 'P2034'].includes(error.code)) {
    return NextResponse.json({ error: 'Conflito de atualização; tente novamente' }, { status: 409 });
  }
  return null;
}

// GET /api/comments?entityType=task&entityId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType e entityId são obrigatórios' },
        { status: 400 }
      );
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.view
    const permissionModule = entityTypeToModule[entityType];
    if (!commentEntityTypeEnum.safeParse(entityType).success || !permissionModule) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(permissionModule, 'view');
    if (!allowed) return errorResponse!;

    if (!commentCreateSchema.shape.entityId.safeParse(entityId).success) {
      return NextResponse.json({ error: 'entityId inválido' }, { status: 400 });
    }

    const { comments, replies } = await prisma.$transaction(async tx => {
      const organizationId = session!.user.organizationId;
      await lockEntity(tx, entityType, entityId, organizationId);
      const scope = { organizationId, entityType, entityId, author: { organizationId } };
      const comments = await tx.comment.findMany({
        where: {
          ...scope,
          parentId: null,
        },
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Buscar replies
      const commentIds = comments.map(c => c.id);
      const replies = commentIds.length > 0
        ? await tx.comment.findMany({
            where: { ...scope, parentId: { in: commentIds } },
            include: {
              author: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          })
        : [];
      return { comments, replies };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    // Agrupar replies
    const repliesMap = new Map<string, typeof replies>();
    replies.forEach(reply => {
      if (!repliesMap.has(reply.parentId!)) {
        repliesMap.set(reply.parentId!, []);
      }
      repliesMap.get(reply.parentId!)!.push(reply);
    });

    const commentsWithReplies = comments.map(comment => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: (repliesMap.get(comment.id) || []).map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    }));

    return NextResponse.json(commentsWithReplies);
  } catch (error) {
    const rejected = referenceError(error);
    if (rejected) return rejected;
    console.error('Erro ao buscar comments:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/comments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ✅ Validação Zod centralizada
    const parsed = parseBody(commentCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // ✅ Permissão granular dinâmica: entityType → módulo.edit
    const permissionModule = entityTypeToModule[data.entityType];
    if (!permissionModule) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(permissionModule, 'edit');
    if (!allowed) return errorResponse!;

    const comment = await prisma.$transaction(async tx => {
      const organizationId = session!.user.organizationId;
      // Revalidate and lock membership while references and INSERT are committed.
      const actor = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT u.id FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = ${session!.user.id} AND u.organization_id = ${organizationId}
          AND u.deleted_at IS NULL AND o.deleted_at IS NULL FOR SHARE OF u, o`);
      if (!actor.length) throw new InvalidCommentReference(403);
      await lockEntity(tx, data.entityType, data.entityId, organizationId);
      if (data.parentId) {
        const parent = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT c.id FROM comments c JOIN users u ON u.id = c.author_id
          WHERE c.id = ${data.parentId} AND c.organization_id = ${organizationId}
            AND c.entity_type = ${data.entityType} AND c.entity_id = ${data.entityId}
            AND u.organization_id = ${organizationId} FOR SHARE OF c, u`);
        if (!parent.length) throw new InvalidCommentReference();
      }
      return tx.comment.create({
        data: {
          organizationId: session!.user.organizationId,
          entityType: data.entityType,
          entityId: data.entityId,
          content: data.content,
          parentId: data.parentId,
          authorId: session!.user.id,
        },
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    return NextResponse.json({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: [],
    }, { status: 201 });
  } catch (error) {
    const rejected = referenceError(error);
    if (rejected) return rejected;
    console.error('Erro ao criar comment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
