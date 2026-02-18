// src/app/api/comments/[id]/route.ts
// Atualização e exclusão de comment com permissões granulares dinâmicas
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { z } from 'zod';
import type { PermissionModule } from '@/types/permissions';

// Mapa: entityType → módulo de permissão
const entityTypeToModule: Record<string, PermissionModule> = {
  task: 'tasks',
  lead: 'leads',
  kanban_card: 'tasks',
  goal: 'projects',
};

const updateCommentSchema = z.object({
  content: z.string().min(1),
});

// PUT /api/comments/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Buscar o comment primeiro para saber o entityType
    const existingComment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.edit
    const module = entityTypeToModule[existingComment.entityType] || 'tasks';
    const { allowed, session, errorResponse } = await checkPermission(module, 'edit');
    if (!allowed) return errorResponse!;

    // Verificar autoria — só o autor pode editar seu próprio comentário
    if (existingComment.authorId !== session!.user.id) {
      return NextResponse.json(
        { error: 'Você só pode editar seus próprios comentários' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateCommentSchema.parse(body);

    const comment = await prisma.comment.update({
      where: { id },
      data: { content: data.content },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Erro ao atualizar comment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/comments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Buscar o comment primeiro para saber o entityType e autoria
    const existingComment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.delete
    const module = entityTypeToModule[existingComment.entityType] || 'tasks';
    const { allowed, session, errorResponse } = await checkPermission(module, 'delete');
    if (!allowed) return errorResponse!;

    // Verificar autoria — autor pode deletar, owner/admin também (via permissão delete já concedida)
    // Se tem permissão de delete no módulo, pode deletar qualquer comment
    // Se não, verifica se é o autor (mas nesse caso já foi barrado acima)
    // Lógica extra: se o usuário tem permissão de delete mas não é o autor,
    // verificar se é owner/admin para deletar comments de outros
    if (existingComment.authorId !== session!.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session!.user.id },
        select: { role: true },
      });

      if (!['owner', 'admin'].includes(user?.role || '')) {
        return NextResponse.json(
          { error: 'Sem permissão para deletar este comentário' },
          { status: 403 }
        );
      }
    }

    // Deletar replies primeiro (cascade manual)
    await prisma.comment.deleteMany({
      where: { parentId: id },
    });

    await prisma.comment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar comment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
