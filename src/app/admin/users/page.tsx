// src/app/admin/users/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Pencil, Trash2, Shield, X, Building2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-400/10 text-purple-400',
  admin: 'bg-red-400/10 text-red-400',
  manager: 'bg-yellow-400/10 text-yellow-400',
  user: 'bg-blue-400/10 text-blue-400',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // debounce de 300ms na busca
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleUpdateRole = async () => {
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole }),
      });

      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao atualizar usuário');
      }
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.role === 'owner') {
      alert('Não é possível excluir o proprietário da organização.');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o usuário "${user.name}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir usuário');
      }
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Usuários</h1>
        <p className="text-gray-400 mt-1">Todos os usuários do sistema ({users.length})</p>
      </div>

      {/* Busca */}
      <div className="relative mb-6 max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p>Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">Usuário</th>
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">Organização</th>
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">Role</th>
                  <th className="text-left text-sm font-medium text-gray-400 px-4 py-3">Criado em</th>
                  <th className="text-right text-sm font-medium text-gray-400 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors">
                    {/* Usuário */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                    </td>

                    {/* Organização */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-gray-500" />
                        <span className="text-gray-300 text-sm">{user.organization?.name || '—'}</span>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-400/10 text-gray-400'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-400">{formatDate(user.createdAt)}</span>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setEditRole(user.role);
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="Alterar role"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Excluir usuário"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Editar Role */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield size={18} />
                Alterar Role
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-white font-medium">{editingUser.name}</p>
                <p className="text-sm text-gray-400">{editingUser.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="owner">Proprietário</option>
                  <option value="admin">Administrador</option>
                  <option value="manager">Gerente</option>
                  <option value="user">Usuário</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateRole}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
