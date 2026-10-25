import { domainCapabilityPatch, domainCapabilityAudit } from '@/lib/domains/commercial-change';
// src/app/api/admin/plans/[id]/route.ts
// API Admin — Atualização e Exclusão de Plano
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { parseBody, adminPlanUpdateSchema } from '@/lib/validations';
import { planFeatureChangeSchema } from '@/lib/validations/plan-features';

// PUT - Atualizar plano
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (admin?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const parsed = parseBody(adminPlanUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const currentPlan = await prisma.plan.findUnique({ where: { id } });
    if (!currentPlan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }

    // Validate only an explicit feature edit or a snapshot about to be propagated.
    // A price/description edit alone preserves even malformed legacy features.
    const featuresToValidate = data.features ?? (data.propagateToOrgs ? currentPlan.features : undefined);
    if (featuresToValidate !== undefined) {
      const featureChange = parseBody(planFeatureChangeSchema(currentPlan.features), { features: featuresToValidate });
      if (!featureChange.success) return featureChange.response;
    }

    const { propagateToOrgs, ...updateData } = data;

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    let propagatedCount = 0;

    if (propagateToOrgs) {
      const result = await prisma.$transaction(async tx => {
        const organizations = await tx.organization.findMany({ where: { plan: currentPlan.name } });
        for (const organization of organizations) {
          const domainPatch = domainCapabilityPatch(organization, plan.features);
          const changed = await tx.organization.updateMany({
            where: { id: organization.id, plan: currentPlan.name, ...(domainPatch.settings ? { features: organization.features, settings: organization.settings } : {}) },
            data: {
              ...(data.name && data.name !== currentPlan.name ? { plan: data.name } : {}),
              maxUsers: plan.maxUsers,
              maxLeads: plan.maxLeads,
              maxProjects: plan.maxProjects,
              maxOs: plan.maxOs,
              maxWhatsappInstances: plan.maxWhatsappInstances,
              features: plan.features,
              ...domainPatch,
            },
          });
          if (changed.count !== 1) throw new Error('CONCURRENT_PLAN_PROPAGATION');
          if (domainPatch.settings) await tx.activity.create({ data: domainCapabilityAudit(organization.id) });
        }
        return { count: organizations.length };
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
  if (admin?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }

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
