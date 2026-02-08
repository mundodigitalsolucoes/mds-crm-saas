// src/app/api/comments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const updateCommentSchema = z.object({
  content: z.string().min(1),
});

interface RouteParams {
  params: { id: string };
}

// PUT /api/comments/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const data = updateCommentSchema.parse(body);

    // Verificar se o comentário pertence ao usuário
    const existingComment = await prisma.comment.findUnique({
      where: { id: params.id },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    if (existingComment.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Você só pode editar seus próprios comentários' },
        { status: 403 }
      );
    }

    const comment = await prisma.comment.update({
      where: { id: params.id },
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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const existingComment = await prisma.comment.findUnique({
      where: { id: params.id },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    // Permitir delete se for autor ou admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (existingComment.authorId !== session.user.id && 
        !['owner', 'admin'].includes(user?.role || '')) {
      return NextResponse.json(
        { error: 'Sem permissão para deletar este comentário' },
        { status: 403 }
      );
    }

    // Deletar replies primeiro
    await prisma.comment.deleteMany({
      where: { parentId: params.id },
    });

    // Deletar comentário
    await prisma.comment.delete({
      where: { id: params.id },
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
