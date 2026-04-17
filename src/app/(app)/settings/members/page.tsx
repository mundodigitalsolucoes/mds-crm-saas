// src/app/(app)/settings/members/page.tsx
// Página de gerenciamento de membros e permissões da organização
// Acesso: admin/owner para gerenciar permissões e convidar membros

'use client';

import Link from 'next/link';
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
  UserPlus,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  MessagesSquare,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { useUsage } from '@/hooks/useUsage';
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

interface ChatwootTeam {
  id: number;
  name: string;
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
  const { isAtLimit, isPlanInactive, formatUsage } = useUsage();

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de permissões
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editPermissions, setEditPermissions] = useState<UserPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Modal de convite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as string,
    chatwootTeamId: undefined as number | undefined,
  });
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Times do Chatwoot para o select do convite
  const [chatwootTeams, setChatwootTeams] = useState<ChatwootTeam[]>([]);
  const [chatwootConnected, setChatwootConnected] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Exclusão de membro
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteUserMsg, setDeleteUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ✅ Bloqueio de criação quando limite atingido ou plano inativo
  const limitReached = isAtLimit('users');
  const planInactive = isPlanInactive();
  const createBlocked = limitReached || planInactive;

  const inviteTooltip = planInactive
    ? 'Seu período de teste expirou. Entre em contato para continuar.'
    : limitReached
      ? `Limite de membros atingido (${formatUsage('users')}). Faça upgrade do plano.`
      : '';

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
  // FETCH TIMES CHATWOOT (ao abrir modal convite)
  // ============================================

  const fetchChatwootTeams = useCallback(async () => {
    try {
      setLoadingTeams(true);
      const res = await fetch('/api/integrations/chatwoot/teams');
      const data = await res.json();
      setChatwootConnected(data.connected ?? false);
      setChatwootTeams(data.teams ?? []);
    } catch {
      setChatwootConnected(false);
      setChatwootTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  // ============================================
  // PERMISSION HANDLERS
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
      if (action === 'view' && !updated[module].view) {
        updated[module] = { view: false, create: false, edit: false, delete: false };
      }
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
      updated[module] = { view: enable, create: enable, edit: enable, delete: enable };
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
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setSaveMessage({ type: 'success', text: data.message || 'Permissões salvas!' });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, permissions: JSON.stringify(editPermissions) }
            : u
        )
      );
      setTimeout(() => { handleCloseEdit(); }, 1500);
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
      if (next.has(module)) { next.delete(module); } else { next.add(module); }
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
  // INVITE HANDLERS
  // ============================================

  const handleOpenInvite = () => {
    if (createBlocked) return;
    setShowInvite(true);
    fetchChatwootTeams();
  };

  const handleInvite = async () => {
    if (createBlocked) return;

    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.password) {
      setInviteMessage({ type: 'error', text: 'Preencha todos os campos' });
      return;
    }
    if (inviteForm.password.length < 8) {
      setInviteMessage({ type: 'error', text: 'Senha deve ter no mínimo 8 caracteres' });
      return;
    }

    setInviting(true);
    setInviteMessage(null);

    try {
      const payload: Record<string, unknown> = {
        name: inviteForm.name,
        email: inviteForm.email,
        password: inviteForm.password,
        role: inviteForm.role,
      };
      if (inviteForm.chatwootTeamId) {
        payload.chatwootTeamId = inviteForm.chatwootTeamId;
      }

      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao convidar membro');
      setInviteMessage({ type: 'success', text: data.message });
      await fetchUsers();
      setTimeout(() => {
        setShowInvite(false);
        setInviteForm({ name: '', email: '', password: '', role: 'user', chatwootTeamId: undefined });
        setInviteMessage(null);
        setShowPassword(false);
      }, 1500);
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao convidar membro',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleCloseInvite = () => {
    setShowInvite(false);
    setInviteForm({ name: '', email: '', password: '', role: 'user', chatwootTeamId: undefined });
    setInviteMessage(null);
    setShowPassword(false);
  };

  // ============================================
  // DELETE HANDLER
  // ============================================

  const handleDeleteUser = async (user: OrgUser) => {
    if (!confirm(`Remover "${user.name}" da equipe? Esta ação não pode ser desfeita.`)) return;
    setDeletingUserId(user.id);
    setDeleteUserMsg(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) {
        setDeleteUserMsg({ type: 'error', text: data.error ?? 'Erro ao remover membro' });
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setDeleteUserMsg({ type: 'success', text: data.message ?? 'Membro removido!' });
      setTimeout(() => setDeleteUserMsg(null), 3000);
    } catch {
      setDeleteUserMsg({ type: 'error', text: 'Erro de conexão ao remover membro' });
    } finally {
      setDeletingUserId(null);
    }
  };

  const availableRoles = (): { value: string; label: string }[] => {
    const roles: { value: string; label: string }[] = [];
    if (currentRole === 'owner') {
      roles.push({ value: 'admin', label: 'Administrador' });
    }
    roles.push({ value: 'manager', label: 'Gerente' });
    roles.push({ value: 'user', label: 'Usuário' });
    return roles;
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
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Membros da Equipe
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie os membros, cargos e permissões da organização
          </p>
        </div>

        {isAdmin && (
          <div className="relative group">
            <button
              onClick={handleOpenInvite}
              disabled={createBlocked}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createBlocked
                ? <AlertTriangle className="w-4 h-4" />
                : <UserPlus className="w-4 h-4" />
              }
              Convidar Membro
            </button>
            {createBlocked && (
              <div className="absolute bottom-full right-0 mb-2 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                {inviteTooltip}
                <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CTA Atendimento ── */}
      <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
              <MessagesSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Operação do Atendimento separada da gestão de membros
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Times e operação do Chatwoot agora ficam na trilha própria de Atendimento.
              </p>
            </div>
          </div>

          <Link
            href="/settings/atendimento/equipes"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm"
          >
            Ir para Equipes do Atendimento
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Feedback exclusão */}
        {deleteUserMsg && (
          <div className={`mx-6 mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
            deleteUserMsg.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {deleteUserMsg.type === 'success'
              ? <Check className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />
            }
            {deleteUserMsg.text}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Membro</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissões</th>
                <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
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
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Membro */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-600 font-semibold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{user.name}</p>
                          <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[user.role] || ROLE_COLORS.user}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>

                    {/* Permissões */}
                    <td className="px-6 py-4">
                      {user.role === 'owner' ? (
                        <span className="text-xs text-amber-600 font-medium">Acesso total</span>
                      ) : hasCustomPerms ? (
                        <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium">
                          <Shield className="w-3.5 h-3.5" />
                          Customizado
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Padrão do cargo</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      {canEditUser(user) ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                          >
                            <Shield className="w-4 h-4" />
                            Permissões
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUserId === user.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remover membro"
                          >
                            {deletingUserId === user.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />
                            }
                          </button>
                        </div>
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
      {/* MODAL DE CONVITE                            */}
      {/* ============================================ */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Convidar Membro</h2>
                  <p className="text-sm text-gray-500">Adicionar novo membro à equipe</p>
                </div>
              </div>
              <button
                onClick={handleCloseInvite}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Banner de limite */}
              {createBlocked && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                  planInactive
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  {planInactive
                    ? <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  }
                  <p className={`text-sm ${planInactive ? 'text-amber-700' : 'text-red-700'}`}>
                    {inviteTooltip}
                  </p>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do membro"
                  disabled={createBlocked}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  disabled={createBlocked}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha temporária</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={inviteForm.password}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    disabled={createBlocked}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Informe essa senha ao membro para o primeiro acesso</p>
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}
                  disabled={createBlocked}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {availableRoles().map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {inviteForm.role === 'admin' && 'Acesso quase total — pode gerenciar membros e configurações'}
                  {inviteForm.role === 'manager' && 'Acesso a leads, projetos, tarefas e relatórios'}
                  {inviteForm.role === 'user' && 'Acesso básico — visualizar e criar conteúdo'}
                </p>
              </div>

              {/* Time Chatwoot */}
              {chatwootConnected && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Chatwoot
                    <span className="ml-1 text-xs text-gray-400 font-normal">(opcional)</span>
                  </label>
                  {loadingTeams ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      <span className="text-sm text-gray-400">Carregando times...</span>
                    </div>
                  ) : chatwootTeams.length === 0 ? (
                    <p className="text-sm text-gray-400 italic px-1">
                      Nenhum time criado ainda. Use Atendimento &gt; Equipes.
                    </p>
                  ) : (
                    <select
                      value={inviteForm.chatwootTeamId ?? ''}
                      onChange={(e) =>
                        setInviteForm((prev) => ({
                          ...prev,
                          chatwootTeamId: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      disabled={createBlocked}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Nenhum time</option>
                      {chatwootTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    O membro será criado como agente no Chatwoot e adicionado ao time selecionado
                  </p>
                </div>
              )}

              {/* Feedback */}
              {inviteMessage && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  inviteMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {inviteMessage.type === 'success'
                    ? <Check className="w-4 h-4 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  }
                  {inviteMessage.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={handleCloseInvite}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || createBlocked}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {inviting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <UserPlus className="w-4 h-4" />
                }
                {inviting ? 'Criando...' : createBlocked ? 'Limite Atingido' : 'Criar Membro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL DE EDIÇÃO DE PERMISSÕES               */}
      {/* ============================================ */}
      {editingUser && editPermissions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Permissões</h2>
                  <p className="text-sm text-gray-500">
                    {editingUser.name} •{' '}
                    <span className="capitalize">{ROLE_LABELS[editingUser.role] || editingUser.role}</span>
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

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleResetToDefault}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar padrão do cargo
                </button>
              </div>

              {ALL_MODULES.map((module) => {
                const isExpanded = expandedModules.has(module);
                const allEnabled = isAllEnabled(module);
                const partial = isPartialEnabled(module);

                return (
                  <div key={module} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleModuleExpand(module)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                        <span className="font-medium text-gray-800 text-sm">{MODULE_LABELS[module]}</span>
                        {allEnabled && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">TOTAL</span>
                        )}
                        {partial && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">PARCIAL</span>
                        )}
                        {!allEnabled && !partial && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">BLOQUEADO</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleModuleAll(module, !allEnabled); }}
                        className={`relative w-9 h-5 rounded-full transition-colors ${allEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${allEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(['view', 'create', 'edit', 'delete'] as PermissionAction[]).map((action) => {
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
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="flex-1">
                {saveMessage && (
                  <p className={`text-sm flex items-center gap-1.5 ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {saveMessage.type === 'success'
                      ? <Check className="w-4 h-4" />
                      : <AlertCircle className="w-4 h-4" />
                    }
                    {saveMessage.text}
                  </p>
                )}
              </div>
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
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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