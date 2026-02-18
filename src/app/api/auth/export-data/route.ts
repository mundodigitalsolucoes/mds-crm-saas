// src/app/api/auth/export-data/route.ts
// LGPD — Portabilidade: exporta todos os dados pessoais do usuário

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        emailVerified: true,
        onboardingCompleted: true,
        preferences: true,
        consentAt: true,
        consentIp: true,
        createdAt: true,
        updatedAt: true,
        // Dados vinculados
        leadsCreated: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            status: true,
            createdAt: true,
          },
        },
        tasksCreated: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
        activities: {
          select: {
            id: true,
            action: true,
            description: true,
            createdAt: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const exportData = {
      _meta: {
        exportedAt: new Date().toISOString(),
        format: 'LGPD - Portabilidade de Dados',
        system: 'MDS CRM',
      },
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      consent: {
        consentAt: user.consentAt,
        consentIp: user.consentIp,
      },
      leadsCreated: user.leadsCreated,
      tasksCreated: user.tasksCreated,
      comments: user.comments,
      activities: user.activities,
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="meus-dados-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error) {
    console.error('Erro ao exportar dados:', error)
    return NextResponse.json({ error: 'Erro ao exportar dados' }, { status: 500 })
  }
}
