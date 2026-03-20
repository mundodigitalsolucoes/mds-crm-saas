// src/lib/checkLimits.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export type LimitedResource = 'users' | 'leads' | 'projects' | 'os' | 'goals';

interface LimitCheckResult {
  allowed: boolean;
  errorResponse: NextResponse | null;
  usage?: { current: number; max: number; resource: LimitedResource };
}

interface PlanStatusResult {
  active: boolean;
  errorResponse: NextResponse | null;
  reason?: 'cancelled' | 'past_due' | 'trial_expired';
}

const LIMIT_FIELD_MAP: Record<LimitedResource, 'maxUsers' | 'maxLeads' | 'maxProjects' | 'maxOs' | 'maxGoals'> = {
  users:    'maxUsers',
  leads:    'maxLeads',
  projects: 'maxProjects',
  os:       'maxOs',
  goals:    'maxGoals',
};

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  users:    'usuários',
  leads:    'leads',
  projects: 'projetos',
  os:       'ordens de serviço',
  goals:    'metas',
};

async function countResource(organizationId: string, resource: LimitedResource): Promise<number> {
  switch (resource) {
    case 'users':
      return prisma.user.count({ where: { organizationId, deletedAt: null } });
    case 'leads':
      return prisma.lead.count({ where: { organizationId } });
    case 'projects':
      return prisma.marketingProject.count({ where: { organizationId } });
    case 'os':
      return prisma.serviceOrder.count({ where: { organizationId } });
    case 'goals':
      return prisma.goal.count({ where: { organizationId } });
    default:
      return 0;
  }
}

export async function checkOrganizationLimit(
  organizationId: string,
  resource: LimitedResource
): Promise<LimitCheckResult> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        maxUsers: true,
        maxLeads: true,
        maxProjects: true,
        maxOs: true,
        maxGoals: true,
        plan: true,
      },
    });

    if (!org) {
      return {
        allowed: false,
        errorResponse: NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 }),
      };
    }

    const limitField = LIMIT_FIELD_MAP[resource];
    const maxAllowed = org[limitField];

    if (maxAllowed <= 0) {
      return { allowed: true, errorResponse: null, usage: { current: 0, max: -1, resource } };
    }

    const currentCount = await countResource(organizationId, resource);

    if (currentCount >= maxAllowed) {
      const label = RESOURCE_LABELS[resource];
      return {
        allowed: false,
        errorResponse: NextResponse.json(
          {
            error: 'Limite do plano atingido',
            detail: `Seu plano (${org.plan}) permite no máximo ${maxAllowed} ${label}. Você já possui ${currentCount}.`,
            code: 'PLAN_LIMIT_REACHED',
            usage: { current: currentCount, max: maxAllowed, resource },
          },
          { status: 403 }
        ),
        usage: { current: currentCount, max: maxAllowed, resource },
      };
    }

    return { allowed: true, errorResponse: null, usage: { current: currentCount, max: maxAllowed, resource } };
  } catch (error) {
    console.error(`[CHECK LIMITS] Erro ao verificar limite de ${resource}:`, error);
    return { allowed: true, errorResponse: null };
  }
}

export async function checkPlanActive(organizationId: string): Promise<PlanStatusResult> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, planStatus: true, trialEndsAt: true },
    });

    if (!org) {
      return {
        active: false,
        errorResponse: NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 }),
      };
    }

    if (org.planStatus === 'cancelled') {
      return {
        active: false, reason: 'cancelled',
        errorResponse: NextResponse.json(
          { error: 'Plano cancelado', detail: 'Seu plano foi cancelado. Acesse as configurações para reativar.', code: 'PLAN_CANCELLED' },
          { status: 403 }
        ),
      };
    }

    if (org.planStatus === 'past_due') {
      return {
        active: false, reason: 'past_due',
        errorResponse: NextResponse.json(
          { error: 'Pagamento pendente', detail: 'Há um pagamento pendente no seu plano. Regularize para continuar.', code: 'PLAN_PAST_DUE' },
          { status: 403 }
        ),
      };
    }

    if (org.plan === 'trial' && org.trialEndsAt && new Date() > new Date(org.trialEndsAt)) {
      return {
        active: false, reason: 'trial_expired',
        errorResponse: NextResponse.json(
          { error: 'Período de teste expirado', detail: 'Seu período de teste terminou. Escolha um plano para continuar.', code: 'TRIAL_EXPIRED' },
          { status: 403 }
        ),
      };
    }

    if (org.planStatus === 'trial_expired') {
      return {
        active: false, reason: 'trial_expired',
        errorResponse: NextResponse.json(
          { error: 'Período de teste expirado', detail: 'Seu período de teste terminou. Escolha um plano para continuar.', code: 'TRIAL_EXPIRED' },
          { status: 403 }
        ),
      };
    }

    return { active: true, errorResponse: null };
  } catch (error) {
    console.error('[CHECK PLAN] Erro ao verificar status do plano:', error);
    return { active: true, errorResponse: null };
  }
}

export async function syncPlanLimits(organizationId: string, planName: string) {
  const plan = await prisma.plan.findUnique({
    where: { name: planName },
    select: { maxUsers: true, maxLeads: true, maxProjects: true, maxOs: true, maxGoals: true, features: true },
  });

  if (!plan) {
    console.error(`[SYNC PLAN] Plano "${planName}" não encontrado`);
    return null;
  }

  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan: planName,
      maxUsers: plan.maxUsers,
      maxLeads: plan.maxLeads,
      maxProjects: plan.maxProjects,
      maxOs: plan.maxOs,
      maxGoals: plan.maxGoals,
      features: plan.features,
    },
  });
}

export async function getOrganizationUsage(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true, planStatus: true, trialEndsAt: true,
      maxUsers: true, maxLeads: true, maxProjects: true, maxOs: true, maxGoals: true,
    },
  });

  if (!org) return null;

  const [users, leads, projects, os, goals] = await Promise.all([
    prisma.user.count({ where: { organizationId, deletedAt: null } }),
    prisma.lead.count({ where: { organizationId } }),
    prisma.marketingProject.count({ where: { organizationId } }),
    prisma.serviceOrder.count({ where: { organizationId } }),
    prisma.goal.count({ where: { organizationId } }),
  ]);

  const pct = (cur: number, max: number) => max > 0 ? Math.round((cur / max) * 100) : 0;

  return {
    plan: org.plan,
    planStatus: org.planStatus,
    trialEndsAt: org.trialEndsAt,
    resources: {
      users:    { current: users,    max: org.maxUsers,    percentage: pct(users,    org.maxUsers) },
      leads:    { current: leads,    max: org.maxLeads,    percentage: pct(leads,    org.maxLeads) },
      projects: { current: projects, max: org.maxProjects, percentage: pct(projects, org.maxProjects) },
      os:       { current: os,       max: org.maxOs,       percentage: pct(os,       org.maxOs) },
      goals:    { current: goals,    max: org.maxGoals,    percentage: pct(goals,    org.maxGoals) },
    },
  };
}