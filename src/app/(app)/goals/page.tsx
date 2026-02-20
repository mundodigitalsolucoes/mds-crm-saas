// src/app/(app)/goals/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Target, Plus, Search, Filter, X,
  CheckCircle2, Clock, XCircle, TrendingUp,
} from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import type { Goal, GoalStatus, GoalType, GoalCategory } from '@/store/goalStore';
import { GoalCard } from '@/components/goals/GoalCard';
import { NewGoalModal } from '@/components/goals/NewGoalModal';
import { GoalDetailModal } from '@/components/goals/GoalDetailModal';
import { PermissionGate } from '@/components/PermissionGate';
import UsageBanner from '@/components/UsageBanner';
import LimitAlert  from '@/components/LimitAlert';

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number;
  icon:  React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const {
    goals, isLoading, fetchGoals,
    filters, setFilters, clearFilters,
    deleteGoal, getProgress,
  } = useGoalStore();

  const [newOpen,        setNewOpen]        = useState(false);
  const [selectedGoal,   setSelectedGoal]   = useState<Goal | null>(null);
  const [goalToDelete,   setGoalToDelete]   = useState<Goal | null>(null);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  // Filtros locais
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState<GoalStatus | ''>('');
  const [filterType,     setFilterType]     = useState<GoalType | ''>('');
  const [filterCategory, setFilterCategory] = useState<GoalCategory | ''>('');
  const [showFilters,    setShowFilters]    = useState(false);

  useEffect(() => {
    fetchGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtro local (debounce simples) ──────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters({
        search:   search   || undefined,
        status:   filterStatus   || undefined,
        type:     filterType     || undefined,
        category: filterCategory || undefined,
      });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterStatus, filterType, filterCategory]);

  // ── Stats derivadas ───────────────────────────────────────────────────────
  const stats = {
    active:    goals.filter((g) => g.status === 'active').length,
    completed: goals.filter((g) => g.status === 'completed').length,
    cancelled: goals.filter((g) => g.status === 'cancelled').length,
    avgProgress: goals.length
      ? Math.round(goals.reduce((acc, g) => acc + getProgress(g), 0) / goals.length)
      : 0,
  };

  const hasFilters = !!(search || filterStatus || filterType || filterCategory);

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDeleteRequest(goal: Goal) {
    setGoalToDelete(goal);
    setConfirmDelete(true);
  }

  async function handleConfirmDelete() {
    if (!goalToDelete) return;
    setDeleting(true);
    await deleteGoal(goalToDelete.id);
    setDeleting(false);
    setConfirmDelete(false);
    setGoalToDelete(null);
    // Fechar detail se era a meta aberta
    if (selectedGoal?.id === goalToDelete.id) setSelectedGoal(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">

      {/* Usage / Limit banners */}
      <UsageBanner />
      <LimitAlert resource="goals" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Target className="w-6 h-6 text-[var(--primary)]" />
            Metas
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Acompanhe os objetivos da sua equipe
          </p>
        </div>

        <PermissionGate module="goals" action="create">
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Meta
          </button>
        </PermissionGate>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Ativas"     value={stats.active}      icon={Clock}         color="bg-blue-500/10 text-blue-500"   />
        <StatCard label="Concluídas" value={stats.completed}   icon={CheckCircle2}  color="bg-green-500/10 text-green-500" />
        <StatCard label="Canceladas" value={stats.cancelled}   icon={XCircle}       color="bg-red-500/10 text-red-500"     />
        <StatCard label="Progresso Médio" value={stats.avgProgress} icon={TrendingUp} color="bg-purple-500/10 text-purple-500" />
      </div>

      {/* Barra de pesquisa + filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar metas..."
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toggle filtros */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${
            showFilters || hasFilters
              ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {hasFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
          )}
        </button>

        {/* Limpar filtros */}
        {hasFilters && (
          <button
            onClick={() => {
              setSearch('');
              setFilterStatus('');
              setFilterType('');
              setFilterCategory('');
              clearFilters();
            }}
            className="text-xs text-[var(--muted-foreground)] hover:text-red-500 flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Painel de filtros */}
      {showFilters && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap gap-4">

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Status</span>
            <div className="flex gap-2 flex-wrap">
              {(['', 'active', 'completed', 'cancelled'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s as GoalStatus | '')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filterStatus === s
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40'
                  }`}
                >
                  {s === ''          ? 'Todos'     :
                   s === 'active'    ? 'Ativas'    :
                   s === 'completed' ? 'Concluídas':
                                      'Canceladas'}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Prazo</span>
            <div className="flex gap-2 flex-wrap">
              {(['', 'short', 'medium', 'long'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t as GoalType | '')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filterType === t
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40'
                  }`}
                >
                  {t === ''       ? 'Todos'       :
                   t === 'short'  ? 'Curto Prazo' :
                   t === 'medium' ? 'Médio Prazo' :
                                    'Longo Prazo'}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Categoria</span>
            <div className="flex gap-2 flex-wrap">
              {(['', 'sales', 'marketing', 'general'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c as GoalCategory | '')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filterCategory === c
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40'
                  }`}
                >
                  {c === ''          ? 'Todas'     :
                   c === 'sales'     ? 'Vendas'    :
                   c === 'marketing' ? 'Marketing' :
                                       'Geral'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid de metas */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[var(--accent)] rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[var(--accent)] rounded w-3/4" />
                  <div className="h-2.5 bg-[var(--accent)] rounded w-1/2" />
                </div>
              </div>
              <div className="h-1.5 bg-[var(--accent)] rounded-full mb-4" />
              <div className="flex gap-2">
                <div className="h-5 bg-[var(--accent)] rounded-full w-16" />
                <div className="h-5 bg-[var(--accent)] rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="p-5 rounded-2xl bg-[var(--accent)]">
            <Target className="w-10 h-10 text-[var(--muted-foreground)]" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[var(--foreground)]">
              {hasFilters ? 'Nenhuma meta encontrada' : 'Nenhuma meta cadastrada'}
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {hasFilters
                ? 'Tente ajustar os filtros aplicados'
                : 'Crie sua primeira meta para começar a acompanhar os objetivos da equipe'}
            </p>
          </div>
          {!hasFilters && (
            <PermissionGate module="goals" action="create">
              <button
                onClick={() => setNewOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all"
              >
                <Plus className="w-4 h-4" />
                Criar Primeira Meta
              </button>
            </PermissionGate>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onOpen={setSelectedGoal}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      <NewGoalModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
      />

      <GoalDetailModal
        goal={selectedGoal}
        onClose={() => setSelectedGoal(null)}
      />

      {/* Confirm Delete */}
      {confirmDelete && goalToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 w-full max-w-sm bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <Target className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">Excluir Meta</h3>
                <p className="text-xs text-[var(--muted-foreground)]">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] mb-6 leading-relaxed">
              Tem certeza que deseja excluir a meta{' '}
              <span className="font-medium text-[var(--foreground)]">"{goalToDelete.title}"</span>?
              Todas as ações vinculadas também serão removidas.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <X className="w-4 h-4" />
                }
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
