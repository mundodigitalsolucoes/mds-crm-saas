import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';

/**
 * GET /api/admin/dashboard — Retorna KPIs globais do sistema
 * Protegido por JWT do SuperAdmin
 */
export async function GET() {
  try {
    // Verifica autenticação do admin
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Executa todas as queries em paralelo para performance
    const [
      totalOrganizations,
      totalUsers,
      totalLeads,
      totalProjects,
      totalTasks,
      totalServiceOrders,
      // Organizações criadas nos últimos 30 dias
      recentOrganizations,
      // Usuários criados nos últimos 30 dias
      recentUsers,
      // Leads criados nos últimos 30 dias
      recentLeads,
      // Top 5 organizações por número de usuários
      organizations,
      // Leads por status (pipeline global)
      leadsByStatus,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.lead.count(),
      prisma.marketingProject.count(),
      prisma.task.count(),
      prisma.serviceOrder.count(),
      prisma.organization.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.lead.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Top organizações com contagem de usuários e leads
      prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          plan: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              leads: true,
            },
          },
        },
        orderBy: {
          users: { _count: 'desc' },
        },
        take: 5,
      }),
      // Pipeline global
      prisma.lead.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    // Formata leads por status para o gráfico
    const pipelineData = leadsByStatus.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    // Formata top organizações
    const topOrganizations = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      plan: org.plan,
      createdAt: org.createdAt,
      users: org._count.users,
      leads: org._count.leads,
    }));

    return NextResponse.json({
      kpis: {
        totalOrganizations,
        totalUsers,
        totalLeads,
        totalProjects,
        totalTasks,
        totalServiceOrders,
        recentOrganizations,
        recentUsers,
        recentLeads,
      },
      pipeline: pipelineData,
      topOrganizations,
    });
  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
