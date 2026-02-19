// src/app/api/admin/plans/[id]/route.ts
// API Admin — Atualização e Exclusão de Plano (com maxOs e propagateToOrgs)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { parseBody, adminPlanUpdateSchema } from '@/lib/validations';

// PUT - Atualizar plano
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();

    // ✅ Validação Zod centralizada (coerce automático de números)
    const parsed = parseBody(adminPlanUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Buscar plano atual para obter o name (slug)
    const currentPlan = await prisma.plan.findUnique({ where: { id } });
    if (!currentPlan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }

    // Extrai propagateToOrgs antes de enviar pro Prisma (não é coluna)
    const { propagateToOrgs, ...updateData } = data;

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    // ✅ Se propagateToOrgs=true, atualiza limites de TODAS as orgs desse plano
    let propagatedCount = 0;
    if (propagateToOrgs) {
      const planName = data.name || currentPlan.name; // usa o novo name se mudou

      const result = await prisma.organization.updateMany({
        where: { plan: currentPlan.name }, // busca pelo name antigo
        data: {
          // Se o name do plano mudou, atualiza também
          ...(data.name && data.name !== currentPlan.name ? { plan: data.name } : {}),
          // Propaga apenas os limites que foram enviados (ou os do plano atualizado)
          maxUsers: plan.maxUsers,
          maxLeads: plan.maxLeads,
          maxProjects: plan.maxProjects,
          maxOs: plan.maxOs,
          features: plan.features,
        },
      });

      propagatedCount = result.count;
    }

    return NextResponse.json({
      ...plan,
      price: Number(plan.price),
      ...(propagateToOrgs
        ? {
            _propagated: true,
            _propagatedCount: propagatedCount,
            message: `Plano atualizado e propagado para ${propagatedCount} organização(ões)`,
          }
        : {}),
    });
  } catch (error) {
    console.error('[ADMIN PLANS] Erro ao atualizar plano:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE - Excluir plano
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
