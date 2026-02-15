// src/app/api/admin/plans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';

// PUT - Atualizar plano
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, displayName, description, price, interval, maxUsers, maxLeads, maxProjects, features, isActive } = body;

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(interval !== undefined && { interval }),
        ...(maxUsers !== undefined && { maxUsers: parseInt(maxUsers) }),
        ...(maxLeads !== undefined && { maxLeads: parseInt(maxLeads) }),
        ...(maxProjects !== undefined && { maxProjects: parseInt(maxProjects) }),
        ...(features !== undefined && { features }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ ...plan, price: Number(plan.price) });
  } catch (error) {
    console.error('[ADMIN PLANS] Erro ao atualizar plano:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE - Excluir plano
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Busca o plano para pegar o name (slug)
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }

    // Verifica se há organizações usando este plano (campo plan é String, não FK)
    const orgsCount = await prisma.organization.count({ where: { plan: plan.name } });
    if (orgsCount > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. ${orgsCount} organização(ões) usam este plano.` },
        { status: 409 }
      );
    }

    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ message: 'Plano excluído com sucesso' });
  } catch (error) {
    console.error('[ADMIN PLANS] Erro ao excluir plano:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
