// src/app/api/comments/route.ts
// API de Comments — Listagem e Criação com permissões granulares dinâmicas por entityType
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { z } from 'zod';
import type { PermissionModule } from '@/types/permissions';

// Mapa: entityType → módulo de permissão
const entityTypeToModule: Record<string, PermissionModule> = {
  task: 'tasks',
  lead: 'leads',
  kanban_card: 'tasks', // kanban_card vive dentro de tasks
  goal: 'projects',     // goals vinculados a projetos
};

const createCommentSchema = z.object({
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  entityType: z.enum(['task', 'lead', 'kanban_card', 'goal']),
  entityId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
});

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
    const module = entityTypeToModule[entityType];
    if (!module) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(module, 'view');
    if (!allowed) return errorResponse!;

    // Buscar comentários principais (sem parentId)
    const comments = await prisma.comment.findMany({
      where: {
        organizationId: session!.user.organizationId,
        entityType,
        entityId,
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
      ? await prisma.comment.findMany({
          where: { parentId: { in: commentIds } },
          include: {
            author: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

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
    const data = createCommentSchema.parse(body);

    // ✅ Permissão granular dinâmica: entityType → módulo.edit
    // Criar comment requer permissão de edição no módulo-pai
    const module = entityTypeToModule[data.entityType];
    if (!module) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(module, 'edit');
    if (!allowed) return errorResponse!;

    const comment = await prisma.comment.create({
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

    // Notificar mencionados ou autor da entidade (futuro: implementar @mentions)

    return NextResponse.json({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: [],
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Erro ao criar comment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
