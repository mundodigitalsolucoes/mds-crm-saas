// src/lib/permissions.ts
// Engine central de permissões do MDS CRM
// Define permissões padrão por role e funções auxiliares

import type {
  UserPermissions,
  PermissionModule,
  PermissionAction,
  ModulePermissions,
  UserRole,
} from '@/types/permissions';

// ============================================
// LISTA DE TODOS OS MÓDULOS DO SISTEMA
// ============================================

export const ALL_MODULES: PermissionModule[] = [
  'leads',
  'tasks',
  'projects',
  'os',
  'agenda',
  'kanban',
  'reports',
  'goals',
  'integrations',
  'settings',
  'users',
];

// ============================================
// LABELS PARA UI (PT-BR)
// ============================================

export const MODULE_LABELS: Record<PermissionModule, string> = {
  leads: 'Leads',
  tasks: 'Tarefas',
  projects: 'Projetos',
  os: 'Ordens de Serviço',
  agenda: 'Agenda',
  kanban: 'Kanban',
  reports: 'Relatórios',
  goals: 'Metas',
  integrations: 'Integrações',
  settings: 'Configurações',
  users: 'Usuários',
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
};

// ============================================
// HELPERS PARA CRIAR CONJUNTOS DE PERMISSÕES
// ============================================

/** Todas as ações permitidas */
const fullAccess = (): ModulePermissions => ({
  view: true,
  create: true,
  edit: true,
  delete: true,
});

/** Somente visualização */
const viewOnly = (): ModulePermissions => ({
  view: true,
  create: false,
  edit: false,
  delete: false,
});

/** Visualizar e criar (sem editar/deletar) */
const viewAndCreate = (): ModulePermissions => ({
  view: true,
  create: true,
  edit: false,
  delete: false,
});

/** Visualizar, criar e editar (sem deletar) */
const noDeletion = (): ModulePermissions => ({
  view: true,
  create: true,
  edit: true,
  delete: false,
});

/** Sem acesso */
const noAccess = (): ModulePermissions => ({
  view: false,
  create: false,
  edit: false,
  delete: false,
});

// ============================================
// PERMISSÕES PADRÃO POR ROLE
// ============================================

/**
 * Owner: acesso total a tudo.
 * É o dono da organização, não pode ter permissões reduzidas.
 */
const ownerPermissions = (): UserPermissions => ({
  leads: fullAccess(),
  tasks: fullAccess(),
  projects: fullAccess(),
  os: fullAccess(),
  agenda: fullAccess(),
  kanban: fullAccess(),
  reports: fullAccess(),
  goals: fullAccess(),
  integrations: fullAccess(),
  settings: fullAccess(),
  users: fullAccess(),
});

/**
 * Admin: acesso total, exceto settings sensíveis (billing/plano).
 * Na prática, quase igual ao owner, mas não pode mudar plano/billing.
 */
const adminPermissions = (): UserPermissions => ({
  leads: fullAccess(),
  tasks: fullAccess(),
  projects: fullAccess(),
  os: fullAccess(),
  agenda: fullAccess(),
  kanban: fullAccess(),
  reports: fullAccess(),
  goals: fullAccess(),
  integrations: fullAccess(),
  settings: noDeletion(), // Pode ver e editar settings, mas não deletar org
  users: noDeletion(),    // Pode gerenciar users, mas não remover admins
});

/**
 * Manager: gerencia operações do dia a dia.
 * Pode criar e editar, mas não pode deletar na maioria dos módulos.
 * Sem acesso a integrações e settings.
 */
const managerPermissions = (): UserPermissions => ({
  leads: noDeletion(),
  tasks: fullAccess(),      // Manager precisa gerenciar tarefas completamente
  projects: noDeletion(),
  os: noDeletion(),
  agenda: fullAccess(),
  kanban: noDeletion(),
  reports: viewOnly(),
  goals: noDeletion(),
  integrations: viewOnly(), // Pode ver status das integrações
  settings: noAccess(),
  users: viewOnly(),        // Pode ver quem está na equipe
});

/**
 * User: operador básico.
 * Visualiza e cria, edita apenas o que é seu (lógica de ownership no backend).
 * Sem acesso a settings, users, integrações.
 */
const userPermissions = (): UserPermissions => ({
  leads: viewAndCreate(),
  tasks: viewAndCreate(),
  projects: viewOnly(),
  os: viewOnly(),
  agenda: viewAndCreate(),
  kanban: viewOnly(),
  reports: viewOnly(),
  goals: viewOnly(),
  integrations: noAccess(),
  settings: noAccess(),
  users: noAccess(),
});

// ============================================
// MAPA DE PERMISSÕES POR ROLE
// ============================================

export const DEFAULT_PERMISSIONS: Record<UserRole, () => UserPermissions> = {
  owner: ownerPermissions,
  admin: adminPermissions,
  manager: managerPermissions,
  user: userPermissions,
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

/**
 * Retorna as permissões padrão para um role.
 * Usado ao criar/convidar um usuário.
 */
export function getDefaultPermissions(role: UserRole): UserPermissions {
  const factory = DEFAULT_PERMISSIONS[role];
  if (!factory) {
    // Fallback seguro: sem acesso
    return DEFAULT_PERMISSIONS.user();
  }
  return factory();
}

/**
 * Serializa permissões para salvar no campo JSON do banco.
 */
export function serializePermissions(permissions: UserPermissions): string {
  return JSON.stringify(permissions);
}

/**
 * Deserializa permissões do banco.
 * Se o JSON for inválido ou vazio, retorna permissões padrão do role.
 */
export function parsePermissions(
  json: string | null | undefined,
  fallbackRole: UserRole = 'user'
): UserPermissions {
  if (!json || json === '[]' || json === '{}') {
    return getDefaultPermissions(fallbackRole);
  }

  try {
    const parsed = JSON.parse(json);

    // Validação básica: checar se tem pelo menos um módulo conhecido
    if (typeof parsed === 'object' && parsed !== null && 'leads' in parsed) {
      // Merge com defaults para garantir que novos módulos tenham permissão definida
      const defaults = getDefaultPermissions(fallbackRole);
      return { ...defaults, ...parsed };
    }

    // JSON antigo (array de strings) — migrar para novo formato
    return getDefaultPermissions(fallbackRole);
  } catch {
    return getDefaultPermissions(fallbackRole);
  }
}

/**
 * Verifica se um usuário tem permissão para uma ação em um módulo.
 * 
 * @param permissions - Permissões do usuário (já parseadas)
 * @param module - Módulo a verificar
 * @param action - Ação a verificar
 * @returns boolean
 * 
 * @example
 * ```ts
 * const canEdit = hasPermission(userPermissions, 'leads', 'edit');
 * ```
 */
export function hasPermission(
  permissions: UserPermissions,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  const modulePerms = permissions[module];
  if (!modulePerms) return false;
  return modulePerms[action] === true;
}

/**
 * Verifica se o role é owner (bypass de permissões em alguns casos).
 */
export function isOwner(role: string): boolean {
  return role === 'owner';
}

/**
 * Verifica se o role é admin ou superior.
 */
export function isAdminOrAbove(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Mapeamento de rotas do app para módulos de permissão.
 * Usado pelo middleware para interceptar navegação.
 */
export const ROUTE_MODULE_MAP: Record<string, PermissionModule> = {
  '/leads': 'leads',
  '/tasks': 'tasks',
  '/projects': 'projects',
  '/os': 'os',
  '/agenda': 'agenda',
  '/kanban': 'kanban',
  '/reports': 'reports',
  '/goals': 'goals',
  '/settings/integrations': 'integrations',
  '/settings': 'settings',
};

/**
 * Mapeamento de rotas de API para módulos de permissão.
 * Usado pelo helper checkApiPermission.
 */
export const API_ROUTE_MODULE_MAP: Record<string, PermissionModule> = {
  '/api/leads': 'leads',
  '/api/tasks': 'tasks',
  '/api/projects': 'projects',
  '/api/os': 'os',
  '/api/agenda': 'agenda',
  '/api/goals': 'goals',
  '/api/integrations': 'integrations',
  '/api/notifications': 'leads', // Notificações são transversais, acesso básico
};

/**
 * Mapeia método HTTP para ação de permissão.
 */
export function httpMethodToAction(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'view';
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'edit';
    case 'DELETE':
      return 'delete';
    default:
      return 'view';
  }
}
