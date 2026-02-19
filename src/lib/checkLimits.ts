// src/lib/checkLimits.ts
// Enforcement de limites do plano para o MDS CRM SaaS
// Verifica contagem atual vs limite da Organization
// Pattern: mesmo retorno do checkPermission → { allowed, errorResponse }

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================
// TIPOS
// ============================================

/** Recursos que possuem limite no plano */
export type LimitedResource = 'users' | 'leads' | 'projects' | 'os';

interface LimitCheckResult {
  allowed: boolean;
  errorResponse: NextResponse | null;
  /** Dados do limite (útil para UI) */
  usage?: {
    current: number;
    max: number;
    resource: LimitedResource;
  };
}

interface PlanStatusResult {
  active: boolean;
  errorResponse: NextResponse | null;
  /** Razão do bloqueio */
  reason?: 'cancelled' | 'past_due' | 'trial_expired';
}

// ============================================
// MAPEAMENTO DE RECURSOS
// ============================================

/** Mapeia recurso → campo de limite na Organization */
const LIMIT_FIELD_MAP: Record<LimitedResource, 'maxUsers' | 'maxLeads' | 'maxProjects' | 'maxOs'> = {
  users: 'maxUsers',
  leads: 'maxLeads',
  projects: 'maxProjects',
  os: 'maxOs',
};

/** Labels amigáveis para mensagens de erro */
const RESOURCE_LABELS: Record<LimitedResource, string> = {
  users: 'usuários',
  leads: 'leads',
  projects: 'projetos',
  os: 'ordens de serviço',
};

// ============================================
// CONTAGEM DE RECURSOS
// ============================================

/**
 * Conta o total de recursos ativos de uma organização.
 * Cada recurso tem sua query específica (exclui soft-deletes, etc).
 */
async function countResource(
  organizationId: string,
  resource: LimitedResource
): Promise<number> {
  switch (resource) {
    case 'users':
      return prisma.user.count({
        where: {
          organizationId,
          deletedAt: null, // LGPD: ignora soft-deleted
        },
      });

    case 'leads':
      return prisma.lead.count({
        where: { organizationId },
      });

    case 'projects':
      return prisma.marketingProject.count({
        where: { organizationId },
      });

    case 'os':
      return prisma.serviceOrder.count({
        where: { organizationId },
      });

    default:
      return 0;
  }
}

// ============================================
// CHECK ORGANIZATION LIMIT
// ============================================

/**
 * Verifica se a organização pode criar mais um recurso do tipo especificado.
 *
 * Fluxo:
 * 1. Busca os limites da Organization (já copiados do Plan)
 * 2. Conta uso atual
 * 3. Compara e retorna allowed/blocked
 *
 * @param organizationId - ID da organização
 * @param resource - Tipo de recurso ('users' | 'leads' | 'projects' | 'os')
 * @returns LimitCheckResult com allowed, errorResponse e usage
 *
 * @example
 * ```ts
 * const limit = await checkOrganizationLimit(orgId, 'leads');
 * if (!limit.allowed) return limit.errorResponse!;
 * ```
 */
export async function checkOrganizationLimit(
  organizationId: string,
  resource: LimitedResource
): Promise<LimitCheckResult> {
  try {
    // 1. Buscar limites da organização
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        maxUsers: true,
        maxLeads: true,
        maxProjects: true,
        maxOs: true,
        plan: true,
      },
    });

    if (!org) {
      return {
        allowed: false,
        errorResponse: NextResponse.json(
          { error: 'Organização não encontrada' },
          { status: 404 }
        ),
      };
    }

    // 2. Obter o limite para este recurso
    const limitField = LIMIT_FIELD_MAP[resource];
    const maxAllowed = org[limitField];

    // Limite 0 ou -1 = ilimitado (para planos enterprise)
    if (maxAllowed <= 0) {
      return {
        allowed: true,
        errorResponse: null,
        usage: { current: 0, max: -1, resource },
      };
    }

    // 3. Contar uso atual
    const currentCount = await countResource(organizationId, resource);

    // 4. Comparar
    if (currentCount >= maxAllowed) {
      const label = RESOURCE_LABELS[resource];
      return {
        allowed: false,
        errorResponse: NextResponse.json(
          {
            error: 'Limite do plano atingido',
            detail: `Seu plano (${org.plan}) permite no máximo ${maxAllowed} ${label}. Você já possui ${currentCount}.`,
            code: 'PLAN_LIMIT_REACHED',
            usage: {
              current: currentCount,
              max: maxAllowed,
              resource,
            },
          },
          { status: 403 }
        ),
        usage: { current: currentCount, max: maxAllowed, resource },
      };
    }

    return {
      allowed: true,
      errorResponse: null,
      usage: { current: currentCount, max: maxAllowed, resource },
    };
  } catch (error) {
    console.error(`[CHECK LIMITS] Erro ao verificar limite de ${resource}:`, error);
    // Em caso de erro, permite a operação (fail-open para não bloquear produção)
    return {
      allowed: true,
      errorResponse: null,
    };
  }
}

// ============================================
// CHECK PLAN STATUS (PLANO ATIVO / TRIAL)
// ============================================

/**
 * Verifica se o plano da organização está ativo.
 *
 * Regras:
 * - planStatus 'active' → OK
 * - planStatus 'cancelled' → Bloqueado
 * - planStatus 'past_due' → Bloqueado (pagamento pendente)
 * - plan 'trial' + trialEndsAt expirado → Bloqueado
 *
 * @param organizationId - ID da organização
 * @returns PlanStatusResult com active, errorResponse e reason
 *
 * @example
 * ```ts
 * const plan = await checkPlanActive(orgId);
 * if (!plan.active) return plan.errorResponse!;
 * ```
 */
export async function checkPlanActive(
  organizationId: string
): Promise<PlanStatusResult> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        planStatus: true,
        trialEndsAt: true,
      },
    });

    if (!org) {
      return {
        active: false,
        errorResponse: NextResponse.json(
          { error: 'Organização não encontrada' },
          { status: 404 }
        ),
      };
    }

    // Plano cancelado
    if (org.planStatus === 'cancelled') {
      return {
        active: false,
        reason: 'cancelled',
        errorResponse: NextResponse.json(
          {
            error: 'Plano cancelado',
            detail: 'Seu plano foi cancelado. Acesse as configurações para reativar.',
            code: 'PLAN_CANCELLED',
          },
          { status: 403 }
        ),
      };
    }

    // Pagamento pendente
    if (org.planStatus === 'past_due') {
      return {
        active: false,
        reason: 'past_due',
        errorResponse: NextResponse.json(
          {
            error: 'Pagamento pendente',
            detail: 'Há um pagamento pendente no seu plano. Regularize para continuar.',
            code: 'PLAN_PAST_DUE',
          },
          { status: 403 }
        ),
      };
    }

    // Trial expirado (verificação por data)
    if (org.plan === 'trial' && org.trialEndsAt) {
      const now = new Date();
      if (now > new Date(org.trialEndsAt)) {
        return {
          active: false,
          reason: 'trial_expired',
          errorResponse: NextResponse.json(
            {
              error: 'Período de teste expirado',
              detail: 'Seu período de teste terminou. Escolha um plano para continuar.',
              code: 'TRIAL_EXPIRED',
            },
            { status: 403 }
          ),
        };
      }
    }

    // Plan status 'trial_expired' explícito
    if (org.planStatus === 'trial_expired') {
      return {
        active: false,
        reason: 'trial_expired',
        errorResponse: NextResponse.json(
          {
            error: 'Período de teste expirado',
            detail: 'Seu período de teste terminou. Escolha um plano para continuar.',
            code: 'TRIAL_EXPIRED',
          },
          { status: 403 }
        ),
      };
    }

    return {
      active: true,
      errorResponse: null,
    };
  } catch (error) {
    console.error('[CHECK PLAN] Erro ao verificar status do plano:', error);
    // Fail-open: não bloqueia em caso de erro
    return {
      active: true,
      errorResponse: null,
    };
  }
}

// ============================================
// SYNC PLAN → ORGANIZATION LIMITS
// ============================================

/**
 * Copia os limites de um Plan para uma Organization.
 * Usado quando:
 * - SuperAdmin cria uma organização
 * - SuperAdmin muda o plano de uma organização
 * - Organização faz upgrade/downgrade via billing
 *
 * @param organizationId - ID da organização
 * @param planName - Nome (slug) do plano
 * @returns Organization atualizada ou null se plano não encontrado
 */
export async function syncPlanLimits(
  organizationId: string,
  planName: string
) {
  // Buscar o plano pelo nome
  const plan = await prisma.plan.findUnique({
    where: { name: planName },
    select: {
      maxUsers: true,
      maxLeads: true,
      maxProjects: true,
      maxOs: true,
      features: true,
    },
  });

  if (!plan) {
    console.error(`[SYNC PLAN] Plano "${planName}" não encontrado`);
    return null;
  }

  // Atualizar a organização com os limites do plano
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan: planName,
      maxUsers: plan.maxUsers,
      maxLeads: plan.maxLeads,
      maxProjects: plan.maxProjects,
      maxOs: plan.maxOs,
      features: plan.features,
    },
  });

  return updated;
}

// ============================================
// HELPERS (para uso em componentes / APIs)
// ============================================

/**
 * Retorna o uso atual de todos os recursos limitados de uma organização.
 * Útil para dashboards, settings, banners de upgrade.
 */
export async function getOrganizationUsage(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true,
      planStatus: true,
      trialEndsAt: true,
      maxUsers: true,
      maxLeads: true,
      maxProjects: true,
      maxOs: true,
    },
  });

  if (!org) return null;

  // Contar todos os recursos em paralelo
  const [users, leads, projects, os] = await Promise.all([
    prisma.user.count({ where: { organizationId, deletedAt: null } }),
    prisma.lead.count({ where: { organizationId } }),
    prisma.marketingProject.count({ where: { organizationId } }),
    prisma.serviceOrder.count({ where: { organizationId } }),
  ]);

  return {
    plan: org.plan,
    planStatus: org.planStatus,
    trialEndsAt: org.trialEndsAt,
    resources: {
      users: { current: users, max: org.maxUsers, percentage: org.maxUsers > 0 ? Math.round((users / org.maxUsers) * 100) : 0 },
      leads: { current: leads, max: org.maxLeads, percentage: org.maxLeads > 0 ? Math.round((leads / org.maxLeads) * 100) : 0 },
      projects: { current: projects, max: org.maxProjects, percentage: org.maxProjects > 0 ? Math.round((projects / org.maxProjects) * 100) : 0 },
      os: { current: os, max: org.maxOs, percentage: org.maxOs > 0 ? Math.round((os / org.maxOs) * 100) : 0 },
    },
  };
}
