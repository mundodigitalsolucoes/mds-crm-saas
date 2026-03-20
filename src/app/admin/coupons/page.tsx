// src/app/admin/coupons/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ToggleLeft,
  ToggleRight,
  Percent,
  DollarSign,
} from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  applicablePlans: string[] | null;
  createdAt: string;
  _count?: { usages: number };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PLANS = ['trial', 'starter', 'professional', 'enterprise'];

const PLAN_COLORS: Record<string, string> = {
  trial:        'text-gray-400 bg-gray-800',
  starter:      'text-blue-400 bg-blue-500/10',
  professional: 'text-purple-400 bg-purple-500/10',
  enterprise:   'text-yellow-400 bg-yellow-500/10',
};

function formatDiscount(coupon: Coupon) {
  if (coupon.discountType === 'percentage') {
    return `${coupon.discountValue}%`;
  }
  return `R$ ${Number(coupon.discountValue).toFixed(2)}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function CopiedToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
      <Check className="w-4 h-4" />
      Código copiado!
    </div>
  );
}

export default function CouponsPage() {
  const [coupons, setCoupons]         = useState<Coupon[]>([]);
  const [pagination, setPagination]   = useState<Pagination>({ total: 0, page: 1, limit: 15, totalPages: 0 });
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [copied, setCopied]           = useState(false);

  // Form state
  const emptyForm = {
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    maxUses: '',
    validFrom: '',
    validUntil: '',
    isActive: true,
    applicablePlans: [] as string[],
  };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCoupons = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      const res  = await fetch(`/api/admin/coupons?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar');
      const data = await res.json();
      setCoupons(data.coupons);
      setPagination(data.pagination);
    } catch {
      setError('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCoupons(1); }, [fetchCoupons]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingCoupon(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code:             coupon.code,
      description:      coupon.description ?? '',
      discountType:     coupon.discountType,
      discountValue:    String(coupon.discountValue),
      maxUses:          coupon.maxUses != null ? String(coupon.maxUses) : '',
      validFrom:        coupon.validFrom ? coupon.validFrom.slice(0, 10) : '',
      validUntil:       coupon.validUntil ? coupon.validUntil.slice(0, 10) : '',
      isActive:         coupon.isActive,
      applicablePlans:  coupon.applicablePlans ?? [],
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCoupon(null);
    setFormError('');
  };

  const togglePlan = (plan: string) => {
    setForm(prev => ({
      ...prev,
      applicablePlans: prev.applicablePlans.includes(plan)
        ? prev.applicablePlans.filter(p => p !== plan)
        : [...prev.applicablePlans, plan],
    }));
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code  = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setForm(prev => ({ ...prev, code }));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setFormError('');
    if (!form.code.trim()) { setFormError('Código é obrigatório'); return; }
    if (!form.discountValue || isNaN(Number(form.discountValue))) { setFormError('Valor do desconto inválido'); return; }
    if (form.discountType === 'percentage' && (Number(form.discountValue) < 1 || Number(form.discountValue) > 100)) {
      setFormError('Percentual deve ser entre 1 e 100');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code:            form.code.toUpperCase().trim(),
        description:     form.description || null,
        discountType:    form.discountType,
        discountValue:   Number(form.discountValue),
        maxUses:         form.maxUses ? Number(form.maxUses) : null,
        validFrom:       form.validFrom || null,
        validUntil:      form.validUntil || null,
        isActive:        form.isActive,
        applicablePlans: form.applicablePlans.length > 0 ? form.applicablePlans : null,
      };

      const url    = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons';
      const method = editingCoupon ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      closeModal();
      fetchCoupons(pagination.page);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggle = async (coupon: Coupon) => {
    try {
      await fetch(`/api/admin/coupons/${coupon.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ isActive: !coupon.isActive }),
      });
      fetchCoupons(pagination.page);
    } catch {
      /* silencioso */
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao excluir');
        return;
      }
      setDeleteConfirm(null);
      fetchCoupons(pagination.page);
    } catch {
      setError('Erro ao excluir cupom');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Cupons de Desconto</h2>
          <p className="text-gray-500 text-sm mt-1">Gerencie cupons e promoções do sistema</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Cupom
        </button>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>

      {/* Erro global */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-gray-950 border border-blue-900/30 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Tag className="w-10 h-10 mb-3" />
            <p className="text-sm">Nenhum cupom encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Código', 'Desconto', 'Usos', 'Validade', 'Planos', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {coupons.map(coupon => (
                  <tr key={coupon.id} className="hover:bg-gray-900/50 transition-colors">

                    {/* Código */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">{coupon.code}</span>
                        <button
                          onClick={() => copyCode(coupon.code)}
                          className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
                          title="Copiar código"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {coupon.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">{coupon.description}</p>
                      )}
                    </td>

                    {/* Desconto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {coupon.discountType === 'percentage'
                          ? <Percent className="w-3.5 h-3.5 text-green-400" />
                          : <DollarSign className="w-3.5 h-3.5 text-green-400" />
                        }
                        <span className="text-sm font-semibold text-green-400">{formatDiscount(coupon)}</span>
                      </div>
                    </td>

                    {/* Usos */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{coupon.usedCount}</span>
                      {coupon.maxUses != null && (
                        <span className="text-xs text-gray-500">/{coupon.maxUses}</span>
                      )}
                      {coupon.maxUses == null && (
                        <span className="text-xs text-gray-600"> ∞</span>
                      )}
                    </td>

                    {/* Validade */}
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {coupon.validFrom && <div>De: {formatDate(coupon.validFrom)}</div>}
                        {coupon.validUntil && <div>Até: {formatDate(coupon.validUntil)}</div>}
                        {!coupon.validFrom && !coupon.validUntil && <span className="text-gray-600">Sem limite</span>}
                      </div>
                    </td>

                    {/* Planos */}
                    <td className="px-4 py-3">
                      {coupon.applicablePlans && coupon.applicablePlans.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {coupon.applicablePlans.map(p => (
                            <span key={p} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PLAN_COLORS[p] ?? 'bg-gray-800 text-gray-400'}`}>
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">Todos</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(coupon)}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          coupon.isActive ? 'text-green-400 hover:text-green-300' : 'text-gray-600 hover:text-gray-400'
                        }`}
                        title="Alternar status"
                      >
                        {coupon.isActive
                          ? <ToggleRight className="w-4 h-4" />
                          : <ToggleLeft className="w-4 h-4" />
                        }
                        {coupon.isActive ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {deleteConfirm === coupon.id ? (
                          <>
                            <button onClick={() => handleDelete(coupon.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Confirmar"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors" title="Cancelar"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(coupon)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirm(coupon.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Deletar"><Trash2 className="w-4 h-4" /></button>
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

        {/* Paginação */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              {pagination.total} cupom(ns) • Página {pagination.page}/{pagination.totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => fetchCoupons(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchCoupons(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast copiar */}
      <CopiedToast show={copied} />

      {/* ═══════════════════════════════════════ */}
      {/* Modal Criar / Editar                   */}
      {/* ═══════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !saving && closeModal()} />
          <div className="relative w-full max-w-lg bg-gray-950 border border-blue-900/30 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
              <h3 className="text-lg font-semibold text-white">
                {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
              </h3>
              <button onClick={() => !saving && closeModal()} className="p-1 text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">

              {/* Código */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Código *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="Ex: DESCONTO20"
                    className="flex-1 px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <button
                    onClick={generateCode}
                    title="Gerar código aleatório"
                    className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors whitespace-nowrap"
                  >
                    Gerar
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: 20% de desconto para novos usuários"
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              {/* Tipo + Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo *</label>
                  <select
                    value={form.discountType}
                    onChange={e => setForm(prev => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    <option value="percentage">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Valor * {form.discountType === 'percentage' ? '(1-100)' : '(R$)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.discountType === 'percentage' ? 100 : undefined}
                    step={form.discountType === 'fixed' ? '0.01' : '1'}
                    value={form.discountValue}
                    onChange={e => setForm(prev => ({ ...prev, discountValue: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder={form.discountType === 'percentage' ? '20' : '97.00'}
                  />
                </div>
              </div>

              {/* Usos máx */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Máx. de usos <span className="text-gray-600">(vazio = ilimitado)</span></label>
                <input
                  type="number"
                  min="1"
                  value={form.maxUses}
                  onChange={e => setForm(prev => ({ ...prev, maxUses: e.target.value }))}
                  placeholder="Ex: 100"
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Válido de</label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={e => setForm(prev => ({ ...prev, validFrom: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Válido até</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={e => setForm(prev => ({ ...prev, validUntil: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Planos aplicáveis */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Planos aplicáveis <span className="text-gray-600">(vazio = todos)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map(plan => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => togglePlan(plan)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        form.applicablePlans.includes(plan)
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : 'border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                <span className="text-sm text-gray-300">Cupom ativo</span>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Erro */}
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800 sticky bottom-0 bg-gray-950">
              <button onClick={closeModal} disabled={saving} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingCoupon ? 'Salvar' : 'Criar Cupom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
