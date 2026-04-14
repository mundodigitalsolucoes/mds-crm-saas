'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Users,
  X,
  Check,
  Smartphone,
  Radio,
  Boxes,
  Sparkles,
  Loader2,
} from 'lucide-react';

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
  maxOs?: number;
  maxWhatsappInstances: number;
  features: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    organizations: number;
  };
}

const CHANNEL_FEATURES = [
  { key: 'site_widget', label: 'Widget do Site' },
  { key: 'instagram_channel', label: 'Instagram' },
  { key: 'email_channel', label: 'E-mail' },
  { key: 'google_business_channel', label: 'Google Business' },
];

const MODULE_FEATURES = [
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'vendas', label: 'Vendas' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'integrations', label: 'Integrações' },
  { key: 'ai_assistant', label: 'Assistente IA' },
  { key: 'advanced_reports', label: 'Relatórios Avançados' },
];

const ADDON_FEATURES = [
  { key: 'extra_whatsapp_addon', label: 'Número extra de WhatsApp' },
  { key: 'extra_user_addon', label: 'Usuário extra' },
  { key: 'extra_ai_addon', label: 'Créditos extras de IA' },
  { key: 'priority_support', label: 'Suporte prioritário' },
  { key: 'white_label', label: 'White Label' },
];

function parseFeatures(features: string): string[] {
  try {
    return JSON.parse(features);
  } catch {
    return [];
  }
}

function formatPrice(price: number, interval: string) {
  if (Number(price) === 0) return 'Grátis';
  return `R$ ${Number(price).toFixed(2)}${interval === 'month' ? '/mês' : '/ano'}`;
}

function featurePill(label: string) {
  return (
    <span className="text-xs bg-blue-400/10 text-blue-300 px-2.5 py-1 rounded-full border border-blue-400/10">
      {label}
    </span>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    displayName: '',
    description: '',
    price: '0',
    interval: 'month',
    maxUsers: '2',
    maxWhatsappInstances: '1',
    maxLeads: '1000',
    maxProjects: '20',
    maxOs: '20',
    features: [] as string[],
    propagateToOrgs: true,
  });

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/plans');
      if (!res.ok) throw new Error('Erro ao carregar planos');
      const data = await res.json();
      setPlans(data);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm({
      name: '',
      displayName: '',
      description: '',
      price: '0',
      interval: 'month',
      maxUsers: '2',
      maxWhatsappInstances: '1',
      maxLeads: '1000',
      maxProjects: '20',
      maxOs: '20',
      features: [],
      propagateToOrgs: true,
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
      maxWhatsappInstances: String(plan.maxWhatsappInstances ?? 1),
      maxLeads: String(plan.maxLeads ?? 1000),
      maxProjects: String(plan.maxProjects ?? 20),
      maxOs: String(plan.maxOs ?? 20),
      features: parseFeatures(plan.features),
      propagateToOrgs: true,
    });
    setShowModal(true);
  };

  const toggleFeature = (feature: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

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

  const handleSave = async () => {
    setSaving(true);

    try {
      const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : '/api/admin/plans';
      const method = editingPlan ? 'PUT' : 'POST';

      const features = [...form.features];

      // Mantém compatibilidade: se o plano tiver pelo menos 1 WA, marca feature whatsapp
      const waCount = Number(form.maxWhatsappInstances);
      const hasWhatsappFeature = features.includes('whatsapp');

      if (waCount !== 0 && !hasWhatsappFeature) features.push('whatsapp');
      if (waCount === 0 && hasWhatsappFeature) {
        const idx = features.indexOf('whatsapp');
        features.splice(idx, 1);
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          displayName: form.displayName,
          description: form.description,
          price: form.price,
          interval: form.interval,
          maxUsers: form.maxUsers,
          maxWhatsappInstances: form.maxWhatsappInstances,
          maxLeads: form.maxLeads,
          maxProjects: form.maxProjects,
          maxOs: form.maxOs,
          features: JSON.stringify(features),
          propagateToOrgs: editingPlan ? form.propagateToOrgs : false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar plano');
      }

      setShowModal(false);
      fetchPlans();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar plano');
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

      if (res.ok) fetchPlans();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos</h1>
          <p className="text-gray-400 mt-1">
            Estruture os planos comerciais por equipe, canais, módulos e add-ons
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} />
          Novo Plano
        </button>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const features = parseFeatures(plan.features);
            const channelLabels = CHANNEL_FEATURES.filter((item) => features.includes(item.key)).map((item) => item.label);
            const moduleLabels = MODULE_FEATURES.filter((item) => features.includes(item.key)).map((item) => item.label);
            const addonLabels = ADDON_FEATURES.filter((item) => features.includes(item.key)).map((item) => item.label);

            return (
              <div
                key={plan.id}
                className={`bg-gray-800/50 border rounded-2xl p-6 ${
                  plan.isActive ? 'border-gray-700' : 'border-red-900/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-4 gap-3">
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

                <div className="mb-5">
                  <span className="text-3xl font-bold text-white">
                    {Number(plan.price) === 0 ? 'Grátis' : `R$ ${Number(plan.price).toFixed(2)}`}
                  </span>
                  {Number(plan.price) > 0 && (
                    <span className="text-gray-400 text-sm ml-1">
                      /{plan.interval === 'month' ? 'mês' : 'ano'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/50">
                    <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-2">
                      <Users size={14} />
                      Equipe
                    </div>
                    <p className="text-white font-semibold">
                      {plan.maxUsers <= 0 ? 'Ilimitado' : `${plan.maxUsers} usuário(s)`}
                    </p>
                  </div>

                  <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/50">
                    <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-2">
                      <Smartphone size={14} />
                      WhatsApp
                    </div>
                    <p className="text-white font-semibold">
                      {plan.maxWhatsappInstances <= 0
                        ? 'Ilimitado'
                        : `${plan.maxWhatsappInstances} número(s)`}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-2">
                      <Radio size={14} />
                      Canais
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {plan.maxWhatsappInstances !== 0 && featurePill('WhatsApp')}
                      {channelLabels.length > 0
                        ? channelLabels.map((label) => <span key={label}>{featurePill(label)}</span>)
                        : <span className="text-xs text-gray-500">Nenhum canal extra</span>}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-2">
                      <Boxes size={14} />
                      Módulos
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {moduleLabels.length > 0
                        ? moduleLabels.map((label) => <span key={label}>{featurePill(label)}</span>)
                        : <span className="text-xs text-gray-500">Nenhum módulo extra</span>}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-2">
                      <Sparkles size={14} />
                      Add-ons
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {addonLabels.length > 0
                        ? addonLabels.map((label) => <span key={label}>{featurePill(label)}</span>)
                        : <span className="text-xs text-gray-500">Sem add-ons liberados</span>}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-gray-900/40 border border-gray-700/40 p-3 mb-5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                    Controles internos
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500 block">Leads</span>
                      <span className="text-white">{plan.maxLeads}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Projetos</span>
                      <span className="text-white">{plan.maxProjects}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">OS</span>
                      <span className="text-white">{plan.maxOs ?? 0}</span>
                    </div>
                  </div>
                </div>

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

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
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

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
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

                <div className="md:col-span-2">
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none resize-none"
                    rows={2}
                    placeholder="Descrição breve do plano"
                  />
                </div>

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
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Intervalo
                  </label>
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

              <div className="rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3">Equipe</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Máx. Usuários
                    </label>
                    <input
                      type="number"
                      value={form.maxUsers}
                      onChange={(e) => setForm((prev) => ({ ...prev, maxUsers: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                      min="-1"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3">Canais</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Máx. WhatsApps
                    </label>
                    <input
                      type="number"
                      value={form.maxWhatsappInstances}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          maxWhatsappInstances: e.target.value,
                        }))
                      }
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                      min="-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use -1 para ilimitado, 0 para sem WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {CHANNEL_FEATURES.map((feature) => (
                    <label
                      key={feature.key}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-700/40 transition-colors"
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

              <div className="rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3">Módulos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {MODULE_FEATURES.map((feature) => (
                    <label
                      key={feature.key}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-700/40 transition-colors"
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

              <div className="rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3">Add-ons</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ADDON_FEATURES.map((feature) => (
                    <label
                      key={feature.key}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-700/40 transition-colors"
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

              <div className="rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3">Controles internos</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Estes campos continuam editáveis, mas não são a vitrine comercial do plano.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Máx. Leads
                    </label>
                    <input
                      type="number"
                      value={form.maxLeads}
                      onChange={(e) => setForm((prev) => ({ ...prev, maxLeads: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                      min="-1"
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
                      min="-1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Máx. OS
                    </label>
                    <input
                      type="number"
                      value={form.maxOs}
                      onChange={(e) => setForm((prev) => ({ ...prev, maxOs: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                      min="-1"
                    />
                  </div>
                </div>
              </div>

              {editingPlan && (
                <label className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.propagateToOrgs}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, propagateToOrgs: e.target.checked }))
                    }
                    className="mt-1 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-blue-300">
                      Propagar mudanças para as organizações deste plano
                    </p>
                    <p className="text-xs text-blue-200/80 mt-1">
                      Isso atualiza os limites reais das organizações que já usam este plano.
                    </p>
                  </div>
                </label>
              )}
            </div>

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
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Salvando...' : editingPlan ? 'Salvar' : 'Criar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}