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
  'atendimento', // ← NOVO
];

// ============================================
// LABELS PARA UI (PT-BR)
// ============================================

export const MODULE_LABELS: Record<PermissionModule, string> = {
  leads:        'Leads',
  tasks:        'Tarefas',
  projects:     'Projetos',
  os:           'Ordens de Serviço',
  agenda:       'Agenda',
  kanban:       'Kanban',
  reports:      'Relatórios',
  goals:        'Metas',
  integrations: 'Integrações',
  settings:     'Configurações',
  users:        'Usuários',
  atendimento:  'Atendimento', // ← NOVO
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view:   'Visualizar',
  create: 'Criar',
  edit:   'Editar',
  delete: 'Excluir',
};

// ============================================
// HELPERS PARA CRIAR CONJUNTOS DE PERMISSÕES
// ============================================

/** Todas as ações permitidas */
const fullAccess = (): ModulePermissions => ({
  view: true, create: true, edit: true, delete: true,
});

/** Somente visualização */
const viewOnly = (): ModulePermissions => ({
  view: true, create: false, edit: false, delete: false,
});

/** Visualizar e criar (sem editar/deletar) */
const viewAndCreate = (): ModulePermissions => ({
  view: true, create: true, edit: false, delete: false,
});

/** Visualizar, criar e editar (sem deletar) */
const noDeletion = (): ModulePermissions => ({
  view: true, create: true, edit: true, delete: false,
});

/** Sem acesso */
const noAccess = (): ModulePermissions => ({
  view: false, create: false, edit: false, delete: false,
});

// ============================================
// PERMISSÕES PADRÃO POR ROLE
// ============================================

/**
 * Owner: acesso total a tudo.
 */
const ownerPermissions = (): UserPermissions => ({
  leads:        fullAccess(),
  tasks:        fullAccess(),
  projects:     fullAccess(),
  os:           fullAccess(),
  agenda:       fullAccess(),
  kanban:       fullAccess(),
  reports:      fullAccess(),
  goals:        fullAccess(),
  integrations: fullAccess(),
  settings:     fullAccess(),
  users:        fullAccess(),
  atendimento:  fullAccess(), // ← NOVO
});

/**
 * Admin: acesso total, exceto settings sensíveis.
 */
const adminPermissions = (): UserPermissions => ({
  leads:        fullAccess(),
  tasks:        fullAccess(),
  projects:     fullAccess(),
  os:           fullAccess(),
  agenda:       fullAccess(),
  kanban:       fullAccess(),
  reports:      fullAccess(),
  goals:        fullAccess(),
  integrations: fullAccess(),
  settings:     noDeletion(),
  users:        noDeletion(),
  atendimento:  fullAccess(), // ← NOVO
});

/**
 * Manager: gerencia operações do dia a dia.
 */
const managerPermissions = (): UserPermissions => ({
  leads:        noDeletion(),
  tasks:        fullAccess(),
  projects:     noDeletion(),
  os:           noDeletion(),
  agenda:       fullAccess(),
  kanban:       noDeletion(),
  reports:      viewOnly(),
  goals:        noDeletion(),
  integrations: viewOnly(),
  settings:     noAccess(),
  users:        viewOnly(),
  atendimento:  fullAccess(), // ← NOVO — manager atende clientes
});

/**
 * User: operador básico.
 */
const userPermissions = (): UserPermissions => ({
  leads:        viewAndCreate(),
  tasks:        viewAndCreate(),
  projects:     viewOnly(),
  os:           viewOnly(),
  agenda:       viewAndCreate(),
  kanban:       viewOnly(),
  reports:      viewOnly(),
  goals:        viewOnly(),
  integrations: noAccess(),
  settings:     noAccess(),
  users:        noAccess(),
  atendimento:  viewOnly(), // ← NOVO — user vê mas não gerencia
});

// ============================================
// MAPA DE PERMISSÕES POR ROLE
// ============================================

export const DEFAULT_PERMISSIONS: Record<UserRole, () => UserPermissions> = {
  owner:   ownerPermissions,
  admin:   adminPermissions,
  manager: managerPermissions,
  user:    userPermissions,
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

export function getDefaultPermissions(role: UserRole): UserPermissions {
  const factory = DEFAULT_PERMISSIONS[role];
  if (!factory) return DEFAULT_PERMISSIONS.user();
  return factory();
}

export function serializePermissions(permissions: UserPermissions): string {
  return JSON.stringify(permissions);
}

export function parsePermissions(
  json: string | null | undefined,
  fallbackRole: UserRole = 'user'
): UserPermissions {
  if (!json || json === '[]' || json === '{}') {
    return getDefaultPermissions(fallbackRole);
  }
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && 'leads' in parsed) {
      // Merge com defaults garante que novos módulos (ex: atendimento)
      // já tenham permissão definida para usuários com JSON antigo no banco
      const defaults = getDefaultPermissions(fallbackRole);
      return { ...defaults, ...parsed };
    }
    return getDefaultPermissions(fallbackRole);
  } catch {
    return getDefaultPermissions(fallbackRole);
  }
}

export function hasPermission(
  permissions: UserPermissions,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  const modulePerms = permissions[module];
  if (!modulePerms) return false;
  return modulePerms[action] === true;
}

export function isOwner(role: string): boolean {
  return role === 'owner';
}

export function isAdminOrAbove(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export const ROUTE_MODULE_MAP: Record<string, PermissionModule> = {
  '/leads':                 'leads',
  '/tasks':                 'tasks',
  '/projects':              'projects',
  '/os':                    'os',
  '/agenda':                'agenda',
  '/kanban':                'kanban',
  '/reports':               'reports',
  '/goals':                 'goals',
  '/atendimento':           'atendimento', // ← NOVO
  '/settings/integrations': 'integrations',
  '/settings':              'settings',
};

export const API_ROUTE_MODULE_MAP: Record<string, PermissionModule> = {
  '/api/leads':         'leads',
  '/api/tasks':         'tasks',
  '/api/projects':      'projects',
  '/api/os':            'os',
  '/api/agenda':        'agenda',
  '/api/goals':         'goals',
  '/api/integrations':  'integrations',
  '/api/notifications': 'leads',
};

export function httpMethodToAction(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case 'GET':    return 'view';
    case 'POST':   return 'create';
    case 'PUT':
    case 'PATCH':  return 'edit';
    case 'DELETE': return 'delete';
    default:       return 'view';
  }
}
