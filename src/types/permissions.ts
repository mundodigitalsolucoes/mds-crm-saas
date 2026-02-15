// src/types/permissions.ts
// Tipos e interfaces para o sistema de permissões granulares do MDS CRM

/**
 * Módulos do sistema que podem ter permissões controladas.
 * Cada módulo corresponde a uma seção do CRM.
 */
export type PermissionModule =
  | 'leads'
  | 'tasks'
  | 'projects'
  | 'os'           // Ordens de Serviço
  | 'agenda'
  | 'kanban'
  | 'reports'
  | 'goals'
  | 'integrations'
  | 'settings'
  | 'users';       // Gerenciamento de membros da org

/**
 * Ações possíveis dentro de cada módulo.
 */
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

/**
 * Estrutura de permissões de um módulo.
 * Cada ação é um boolean (pode ou não pode).
 */
export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

/**
 * Mapa completo de permissões do usuário.
 * Cada chave é um módulo, cada valor é o conjunto de ações permitidas.
 */
export type UserPermissions = Record<PermissionModule, ModulePermissions>;

/**
 * Roles disponíveis no sistema.
 */
export type UserRole = 'owner' | 'admin' | 'manager' | 'user';

/**
 * Formato serializado para salvar no banco (campo permissions do User).
 * O campo User.permissions armazena este objeto como JSON string.
 */
export type SerializedPermissions = string; // JSON.stringify(UserPermissions)
