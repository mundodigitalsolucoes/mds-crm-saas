// src/app/api/auth/delete-account/route.ts
// LGPD — Eliminação: anonimiza dados pessoais do usuário

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Verificar se é owner — owner não pode deletar pois é dono da org
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (user.role === 'owner') {
      return NextResponse.json(
        {
          error:
            'Proprietários não podem excluir a conta diretamente. Transfira a propriedade da organização primeiro ou entre em contato com o suporte.',
        },
        { status: 403 }
      )
    }

    // Anonimizar dados pessoais (soft delete + anonimização)
    const anonymousHash = crypto.randomBytes(8).toString('hex')

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: `Usuário Removido`,
        email: `deleted-${anonymousHash}@removed.local`,
        passwordHash: '',
        avatarUrl: null,
        preferences: '{}',
        consentIp: null,
        deletedAt: new Date(),
      },
    })

    // Limpar comentários pessoais (conteúdo, não o registro)
    await prisma.comment.updateMany({
            where: { authorId: userId },
      data: { content: '[Conteúdo removido por solicitação LGPD]' },
    })

    return NextResponse.json({
      message: 'Conta excluída e dados anonimizados com sucesso',
    })
  } catch (error) {
    console.error('Erro ao excluir conta:', error)
    return NextResponse.json({ error: 'Erro ao excluir conta' }, { status: 500 })
  }
}
