'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Search,
  Plus,
  Users,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Check,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  planStatus: string | null;
  trialEndsAt: string | null;
  deletedAt: string | null;
  limits: {
    maxUsers: number | null;
    maxLeads: number | null;
    maxProjects: number | null;
    maxOs: number | null;
    maxWhatsappInstances?: number | null;
  };
  usage: {
    users: number;
    leads: number;
    projects: number;
    tasks: number;
    serviceOrders: number;
    whatsappInstances?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const planOptions = [
  { value: 'trial', label: 'Trial', color: 'text-cyan-300 bg-cyan-500/10' },
  { value: 'starter', label: 'Starter', color: 'text-blue-300 bg-blue-500/10' },
  { value: 'professional', label: 'Professional', color: 'text-violet-300 bg-violet-500/10' },
  { value: 'enterprise', label: 'Enterprise', color: 'text-amber-300 bg-amber-500/10' },
];

function getPlanBadge(plan: string | null) {
  const found = planOptions.find((item) => item.value === plan);

  if (!found) {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-gray-300 bg-gray-800">
        {plan || 'Sem plano'}
      </span>
    );
  }

  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${found.color}`}>
      {found.label}
    </span>
  );
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'trial',
  });

  const fetchOrganizations = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });

      if (search) params.set('search', search);
      if (planFilter) params.set('plan', planFilter);

      const res = await fetch(`/api/admin/organizations?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar organizações');

      const data = await res.json();
      setOrganizations(data.organizations);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar organizações');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter]);

  useEffect(() => {
    fetchOrganizations(1);
  }, [fetchOrganizations]);

  const handleCreate = () => {
    setEditingOrg(null);
    setFormData({
      name: '',
      slug: '',
      plan: 'trial',
    });
    setShowModal(true);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      plan: org.plan || 'trial',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) return;

    setSaving(true);

    try {
      const url = editingOrg
        ? `/api/admin/organizations/${editingOrg.id}`
        : '/api/admin/organizations';

      const res = await fetch(url, {
        method: editingOrg ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          syncFromPlan: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setShowModal(false);
      await fetchOrganizations(pagination.page);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar organização');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Erro ao deletar');

      setDeleteConfirm(null);
      await fetchOrganizations(pagination.page);
    } catch {
      setError('Erro ao deletar organização');
    }
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingOrg
        ? prev.slug
        : name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-'),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Organizações</h2>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie organizações e sincronize seus limites com o plano escolhido
          </p>
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Organização
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
        >
          <option value="">Todos os planos</option>
          {planOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-gray-950 border border-blue-900/30 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Building2 className="w-10 h-10 mb-3" />
            <p className="text-sm">Nenhuma organização encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                    Organização
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                    Plano
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    Usuários
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                    <Smartphone className="w-3.5 h-3.5 inline mr-1" />
                    WhatsApp
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                    Criado
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-800/50">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{org.name}</p>
                      <p className="text-[11px] text-gray-600">/{org.slug}</p>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {getPlanBadge(org.plan)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-white">{org.usage.users}</span>
                      <span className="text-[11px] text-gray-600">
                        /{org.limits.maxUsers ?? '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-white">
                        {org.usage.whatsappInstances ?? 0}
                      </span>
                      <span className="text-[11px] text-gray-600">
                        /{org.limits.maxWhatsappInstances ?? '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {deleteConfirm === org.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(org.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Confirmar exclusão"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="p-1.5 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(org)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(org.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Deletar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              {pagination.total} organização{pagination.total !== 1 ? 'ões' : ''} • Página{' '}
              {pagination.page} de {pagination.totalPages}
            </p>

            <div className="flex gap-1">
              <button
                onClick={() => fetchOrganizations(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => fetchOrganizations(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !saving && setShowModal(false)}
          />

          <div className="relative w-full max-w-md bg-gray-950 border border-blue-900/30 rounded-xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">
                {editingOrg ? 'Editar Organização' : 'Nova Organização'}
              </h3>
              <button
                onClick={() => !saving && setShowModal(false)}
                className="p-1 text-gray-500 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Mundo Digital Soluções"
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Slug * <span className="text-gray-600">(identificador único)</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="Ex: mundo-digital"
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Plano
                </label>
                <select
                  value={formData.plan}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, plan: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  {planOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-blue-900/30 bg-blue-950/20 p-3">
                <p className="text-xs text-blue-300">
                  Ao salvar, os limites da organização serão sincronizados pelo plano selecionado.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !formData.slug.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingOrg ? 'Salvar Alterações' : 'Criar Organização'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}