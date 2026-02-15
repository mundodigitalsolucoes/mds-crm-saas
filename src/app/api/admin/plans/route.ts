// src/app/api/admin/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';

// GET - Listar todos os planos
export async function GET() {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const plans = await prisma.plan.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Conta organizações por plano manualmente (plan é String na Organization, não FK)
    const plansWithCount = await Promise.all(
      plans.map(async (plan) => {
        const orgCount = await prisma.organization.count({
          where: { plan: plan.name },
        });

        return {
          ...plan,
          price: Number(plan.price),
          _count: { organizations: orgCount },
        };
      })
    );

    return NextResponse.json(plansWithCount);
  } catch (error) {
    console.error('[ADMIN PLANS] Erro ao listar planos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - Criar novo plano
export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, displayName, description, price, interval, maxUsers, maxLeads, maxProjects, features } = body;

    if (!name || !displayName) {
      return NextResponse.json({ error: 'Nome (slug) e nome de exibição são obrigatórios' }, { status: 400 });
    }

    // Verifica se name já existe
    const existing = await prisma.plan.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Já existe um plano com este nome (slug)' }, { status: 409 });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        displayName,
        description: description || null,
        price: price ? parseFloat(price) : 0,
        interval: interval || 'month',
        maxUsers: maxUsers ? parseInt(maxUsers) : 5,
        maxLeads: maxLeads ? parseInt(maxLeads) : 100,
        maxProjects: maxProjects ? parseInt(maxProjects) : 10,
        features: features || '[]',
      },
    });

    return NextResponse.json({ ...plan, price: Number(plan.price), _count: { organizations: 0 } }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN PLANS] Erro ao criar plano:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
