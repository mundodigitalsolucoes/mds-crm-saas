// src/app/api/admin/plans/route.ts
// API Admin — Listagem e Criação de Planos
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { parseBody, adminPlanCreateSchema } from '@/lib/validations';

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

    // ✅ Validação Zod centralizada (coerce de price/maxUsers/maxLeads/maxProjects)
    const parsed = parseBody(adminPlanCreateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Verifica se name já existe
    const existing = await prisma.plan.findUnique({ where: { name: data.name } });
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um plano com este nome (slug)' },
        { status: 409 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        price: data.price,
        interval: data.interval,
        maxUsers: data.maxUsers,
        maxLeads: data.maxLeads,
        maxProjects: data.maxProjects,
        features: data.features,
      },
    });

    return NextResponse.json(
      { ...plan, price: Number(plan.price), _count: { organizations: 0 } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ADMIN PLANS] Erro ao criar plano:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
