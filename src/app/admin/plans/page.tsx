// src/app/admin/plans/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Plus, Pencil, Trash2, Users, X, Check } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  interval: string;
  maxUsers: number;
  maxLeads: number;
  maxProjects: number;
  features: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    organizations: number;
  };
}

const AVAILABLE_FEATURES = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'meta_ads', label: 'Meta Ads' },
  { key: 'google_ads', label: 'Google Ads' },
  { key: 'ai_assistant', label: 'Assistente IA' },
  { key: 'email_marketing', label: 'Email Marketing' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'api_access', label: 'Acesso API' },
  { key: 'white_label', label: 'White Label' },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: '',
    displayName: '',
    description: '',
    price: '0',
    interval: 'month',
    maxUsers: '5',
    maxLeads: '100',
    maxProjects: '10',
    features: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const parseFeatures = (features: string): string[] => {
    try {
      return JSON.parse(features);
    } catch {
      return [];
    }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm({
      name: '',
      displayName: '',
      description: '',
      price: '0',
      interval: 'month',
      maxUsers: '5',
      maxLeads: '100',
      maxProjects: '10',
      features: [],
    });
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description || '',
      price: String(plan.price),
      interval: plan.interval,
      maxUsers: String(plan.maxUsers),
      maxLeads: String(plan.maxLeads),
      maxProjects: String(plan.maxProjects),
      features: parseFeatures(plan.features),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : '/api/admin/plans';
      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          features: JSON.stringify(form.features),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchPlans();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar plano');
      }
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Tem certeza que deseja excluir o plano "${plan.displayName}"?`)) return;

    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPlans();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir plano');
      }
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });

      if (res.ok) {
        fetchPlans();
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const toggleFeature = (feature: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  // Gera slug automaticamente a partir do displayName
  const handleDisplayNameChange = (displayName: string) => {
    setForm((prev) => ({
      ...prev,
      displayName,
      name: editingPlan
        ? prev.name
        : displayName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
    }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos</h1>
          <p className="text-gray-400 mt-1">Gerencie os planos disponíveis no sistema</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} />
          Novo Plano
        </button>
      </div>

      {/* Grid de Planos */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
          <p>Nenhum plano cadastrado</p>
          <button
            onClick={openCreateModal}
            className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
          >
            Criar primeiro plano
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const features = parseFeatures(plan.features);
            return (
              <div
                key={plan.id}
                className={`bg-gray-800/50 border rounded-xl p-6 ${
                  plan.isActive ? 'border-gray-700' : 'border-red-900/50 opacity-60'
                }`}
              >
                {/* Cabeçalho do card */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{plan.displayName}</h3>
                    <p className="text-sm text-gray-500">/{plan.name}</p>
                    {plan.description && (
                      <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(plan)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        plan.isActive
                          ? 'text-green-400 hover:bg-green-400/10'
                          : 'text-red-400 hover:bg-red-400/10'
                      }`}
                      title={plan.isActive ? 'Desativar' : 'Ativar'}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => openEditModal(plan)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Preço */}
                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">
                    {Number(plan.price) === 0 ? 'Grátis' : `R$ ${Number(plan.price).toFixed(2)}`}
                  </span>
                  {Number(plan.price) > 0 && (
                    <span className="text-gray-400 text-sm">
                      /{plan.interval === 'month' ? 'mês' : 'ano'}
                    </span>
                  )}
                </div>

                {/* Limites */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Usuários</span>
                    <span className="text-white">{plan.maxUsers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Leads</span>
                    <span className="text-white">{plan.maxLeads}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Projetos</span>
                    <span className="text-white">{plan.maxProjects}</span>
                  </div>
                </div>

                {/* Features */}
                {features.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1.5">
                      {features.map((f) => (
                        <span
                          key={f}
                          className="text-xs bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded-full"
                        >
                          {AVAILABLE_FEATURES.find((af) => af.key === f)?.label || f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rodapé */}
                <div className="pt-4 border-t border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm text-gray-400">
                    <Users size={14} />
                    <span>{plan._count.organizations} org(s)</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      plan.isActive
                        ? 'bg-green-400/10 text-green-400'
                        : 'bg-red-400/10 text-red-400'
                    }`}
                  >
                    {plan.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header do modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">
                {editingPlan ? 'Editar Plano' : 'Novo Plano'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body do modal */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nome de Exibição *
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Ex: Starter, Professional, Enterprise"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Slug (identificador único) *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={!!editingPlan}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  placeholder="ex: starter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="Descrição breve do plano"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Intervalo</label>
                  <select
                    value={form.interval}
                    onChange={(e) => setForm((prev) => ({ ...prev, interval: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="month">Mensal</option>
                    <option value="year">Anual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Máx. Usuários
                  </label>
                  <input
                    type="number"
                    value={form.maxUsers}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxUsers: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Máx. Leads
                  </label>
                  <input
                    type="number"
                    value={form.maxLeads}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxLeads: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Máx. Projetos
                  </label>
                  <input
                    type="number"
                    value={form.maxProjects}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, maxProjects: e.target.value }))
                    }
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    min="1"
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Features</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_FEATURES.map((feature) => (
                    <label
                      key={feature.key}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={form.features.includes(feature.key)}
                        onChange={() => toggleFeature(feature.key)}
                        className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">{feature.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer do modal */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-700 sticky bottom-0 bg-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.displayName}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {saving ? 'Salvando...' : editingPlan ? 'Salvar' : 'Criar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
