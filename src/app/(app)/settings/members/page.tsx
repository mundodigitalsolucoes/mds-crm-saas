// src/app/(app)/settings/members/page.tsx
// Página de gerenciamento de membros e permissões da organização
// Acesso: users.view para ver, admin/owner para editar permissões

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  X,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Loader2,
  Crown,
  ShieldCheck,
  UserCog,
  User as UserIcon,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import {
  ALL_MODULES,
  MODULE_LABELS,
  ACTION_LABELS,
  getDefaultPermissions,
  parsePermissions,
} from '@/lib/permissions';
import type {
  PermissionModule,
  PermissionAction,
  UserPermissions,
  UserRole,
} from '@/types/permissions';

// ============================================
// TIPOS
// ============================================

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string | null;
  createdAt: string;
}

// ============================================
// CONSTANTES
// ============================================

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  user: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: ShieldCheck,
  manager: UserCog,
  user: UserIcon,
};

const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function MembersPage() {
  const { role: currentRole, isAdmin, isLoading: permLoading } = usePermission();

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editPermissions, setEditPermissions] = useState<UserPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // ============================================
  // FETCH USERS
  // ============================================

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/users');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao carregar membros');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permLoading) {
      fetchUsers();
    }
  }, [fetchUsers, permLoading]);

  // ============================================
  // HANDLERS
  // ============================================

  const canEditUser = (targetUser: OrgUser): boolean => {
    if (!isAdmin) return false;
    if (targetUser.role === 'owner') return false;
    if (currentRole !== 'owner') {
      const currentPower = ROLE_HIERARCHY[currentRole || ''] || 0;
      const targetPower = ROLE_HIERARCHY[targetUser.role] || 0;
      if (targetPower >= currentPower) return false;
    }
    return true;
  };

  const handleOpenEdit = (user: OrgUser) => {
    const parsed = parsePermissions(user.permissions, user.role as UserRole);
    setEditPermissions(parsed);
    setEditingUser(user);
    setSaveMessage(null);
    // Expandir todos os módulos por padrão
    setExpandedModules(new Set(ALL_MODULES));
  };

  const handleCloseEdit = () => {
    setEditingUser(null);
    setEditPermissions(null);
    setSaveMessage(null);
    setExpandedModules(new Set());
  };

  const handleTogglePermission = (module: PermissionModule, action: PermissionAction) => {
    if (!editPermissions) return;

    setEditPermissions((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated[module] = { ...updated[module], [action]: !updated[module][action] };

      // Se desativar view, desativar todas as outras ações do módulo
      if (action === 'view' && !updated[module].view) {
        updated[module] = { view: false, create: false, edit: false, delete: false };
      }

      // Se ativar create/edit/delete, ativar view automaticamente
      if (action !== 'view' && updated[module][action] && !updated[module].view) {
        updated[module] = { ...updated[module], view: true };
      }

      return updated;
    });
  };

  const handleToggleModuleAll = (module: PermissionModule, enable: boolean) => {
    if (!editPermissions) return;

    setEditPermissions((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated[module] = {
        view: enable,
        create: enable,
        edit: enable,
        delete: enable,
      };
      return updated;
    });
  };

  const handleResetToDefault = () => {
    if (!editingUser) return;
    const defaults = getDefaultPermissions(editingUser.role as UserRole);
    setEditPermissions(defaults);
    setSaveMessage({ type: 'success', text: 'Restaurado para padrão do cargo' });
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleSave = async () => {
    if (!editingUser || !editPermissions) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/users/${editingUser.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editPermissions }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar');
      }

      setSaveMessage({ type: 'success', text: data.message || 'Permissões salvas!' });

      // Atualizar lista local
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, permissions: JSON.stringify(editPermissions) }
            : u
        )
      );

      // Fechar modal após 1.5s
      setTimeout(() => {
        handleCloseEdit();
      }, 1500);
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao salvar permissões',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleModuleExpand = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  };

  const isAllEnabled = (module: PermissionModule): boolean => {
    if (!editPermissions) return false;
    const m = editPermissions[module];
    return m.view && m.create && m.edit && m.delete;
  };

  const isPartialEnabled = (module: PermissionModule): boolean => {
    if (!editPermissions) return false;
    const m = editPermissions[module];
    const count = [m.view, m.create, m.edit, m.delete].filter(Boolean).length;
    return count > 0 && count < 4;
  };

  // ============================================
  // RENDER
  // ============================================

  if (permLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-indigo-600" />
          Membros da Equipe
        </h1>
        <p className="text-gray-600 mt-1">
          Gerencie os membros e suas permissões de acesso
        </p>
      </div>

      {/* Tabela de Membros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Membro
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Permissões
                </th>
                <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const RoleIcon = ROLE_ICONS[user.role] || UserIcon;
                const hasCustomPerms =
                  user.permissions &&
                  user.permissions !== '[]' &&
                  user.permissions !== '{}';

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Nome + Email */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-600 font-semibold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {user.name}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          ROLE_COLORS[user.role] || ROLE_COLORS.user
                        }`}
                      >
                        <RoleIcon className="w-3.5 h-3.5" />
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>

                    {/* Status das permissões */}
                    <td className="px-6 py-4">
                      {user.role === 'owner' ? (
                        <span className="text-xs text-amber-600 font-medium">
                          Acesso total
                        </span>
                      ) : hasCustomPerms ? (
                        <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium">
                          <Shield className="w-3.5 h-3.5" />
                          Customizado
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          Padrão do cargo
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      {canEditUser(user) ? (
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Permissões
                        </button>
                      ) : user.role === 'owner' ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <span className="text-xs text-gray-400">Sem acesso</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Nenhum membro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================ */}
      {/* MODAL DE EDIÇÃO DE PERMISSÕES */}
      {/* ============================================ */}
      {editingUser && editPermissions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Permissões
                  </h2>
                  <p className="text-sm text-gray-500">
                    {editingUser.name} •{' '}
                    <span className="capitalize">
                      {ROLE_LABELS[editingUser.role] || editingUser.role}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseEdit}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {/* Reset button */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleResetToDefault}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar padrão do cargo
                </button>
              </div>

              {/* Modules */}
              {ALL_MODULES.map((module) => {
                const isExpanded = expandedModules.has(module);
                const allEnabled = isAllEnabled(module);
                const partial = isPartialEnabled(module);

                return (
                  <div
                    key={module}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Module Header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleModuleExpand(module)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-800 text-sm">
                          {MODULE_LABELS[module]}
                        </span>
                        {allEnabled && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                            TOTAL
                          </span>
                        )}
                        {partial && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                            PARCIAL
                          </span>
                        )}
                        {!allEnabled && !partial && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                            BLOQUEADO
                          </span>
                        )}
                      </div>

                      {/* Toggle All */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleModuleAll(module, !allEnabled);
                        }}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          allEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            allEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Module Actions */}
                    {isExpanded && (
                      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(['view', 'create', 'edit', 'delete'] as PermissionAction[]).map(
                          (action) => {
                            const enabled = editPermissions[module][action];

                            return (
                              <button
                                key={action}
                                onClick={() => handleTogglePermission(module, action)}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                                  enabled
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                }`}
                              >
                                {enabled && <Check className="w-3.5 h-3.5" />}
                                {ACTION_LABELS[action]}
                              </button>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
              {/* Feedback */}
              <div className="flex-1">
                {saveMessage && (
                  <p
                    className={`text-sm flex items-center gap-1.5 ${
                      saveMessage.type === 'success'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {saveMessage.type === 'success' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    {saveMessage.text}
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Salvando...' : 'Salvar Permissões'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
