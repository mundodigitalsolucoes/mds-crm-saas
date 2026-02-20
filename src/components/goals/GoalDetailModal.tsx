// src/components/goals/GoalDetailModal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  X, Target, TrendingUp, Calendar, Plus, Loader2,
  CheckCircle2, XCircle, Edit3, Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGoalStore } from '@/store/goalStore';
import type { Goal } from '@/store/goalStore';
import { GoalActionItem } from './GoalActionItem';
import { PermissionGate } from '@/components/PermissionGate';
import { cn } from '@/lib/utils';

interface GoalDetailModalProps {
  goal:    Goal | null;
  onClose: () => void;
}

export function GoalDetailModal({ goal, onClose }: GoalDetailModalProps) {
  const {
    updateGoal, addAction, getProgress,
    getTypeLabel, getCategoryLabel, getStatusLabel,
    getStatusColor, getCategoryColor, isLoading,
  } = useGoalStore();

  // ── Estado de edição inline do currentValue ──────────────────────────────
  const [editingValue, setEditingValue] = useState(false);
  const [tempValue,    setTempValue]    = useState('');

  // ── Nova ação ────────────────────────────────────────────────────────────
  const [newActionTitle, setNewActionTitle] = useState('');
  const [addingAction,   setAddingAction]   = useState(false);
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (goal) setTempValue(String(goal.currentValue ?? 0));
  }, [goal]);

  if (!goal) return null;

  const progress        = getProgress(goal);
  const completedCount  = goal.actions.filter((a) => a.completed).length;
  const isActive        = goal.status === 'active';

  // ── Salvar novo valor atual ──────────────────────────────────────────────
  async function handleSaveValue() {
    const parsed = parseFloat(tempValue);
    if (isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    await updateGoal(goal!.id, { currentValue: parsed });
    setSaving(false);
    setEditingValue(false);
  }

  // ── Adicionar ação ───────────────────────────────────────────────────────
  async function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    if (!newActionTitle.trim()) return;
    setAddingAction(true);
    await addAction(goal!.id, { title: newActionTitle.trim() });
    setNewActionTitle('');
    setAddingAction(false);
  }

  // ── Completar / Cancelar meta ────────────────────────────────────────────
  async function handleStatusChange(status: 'completed' | 'cancelled') {
    setSaving(true);
    await updateGoal(goal!.id, { status });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border)] max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-[var(--primary)]/10 shrink-0 mt-0.5">
              <Target className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-[var(--foreground)] leading-snug">
                {goal.title}
              </h2>
              {goal.description && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                  {goal.description}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', getCategoryColor(goal.category))}>
              {getCategoryLabel(goal.category)}
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]">
              {getTypeLabel(goal.type)}
            </span>
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', getStatusColor(goal.status))}>
              {getStatusLabel(goal.status)}
            </span>
          </div>

          {/* Datas */}
          {(goal.startDate || goal.deadline) && (
            <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
              {goal.startDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Início: {format(new Date(goal.startDate), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
              {goal.deadline && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Prazo: {format(new Date(goal.deadline), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
          )}

          {/* Progresso numérico */}
          {goal.targetValue && goal.targetValue > 0 ? (
            <div className="bg-[var(--accent)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Progresso {goal.unit ? `(${goal.unit})` : ''}
                </span>
                <span className="text-lg font-bold text-[var(--foreground)]">{progress}%</span>
              </div>

              <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width:           `${progress}%`,
                    backgroundColor: progress >= 100 ? '#22c55e' : 'var(--primary)',
                  }}
                />
              </div>

              {/* Edição inline do valor atual */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editingValue ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveValue()}
                        autoFocus
                        className="w-28 bg-[var(--card)] border border-[var(--primary)] rounded-lg px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none"
                      />
                      <button
                        onClick={handleSaveValue}
                        disabled={saving}
                        className="p-1.5 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => setEditingValue(false)}
                        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--card)] transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <PermissionGate module="goals" action="edit">
                      <button
                        onClick={() => isActive && setEditingValue(true)}
                        disabled={!isActive}
                        className={cn(
                          'flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)] transition-colors',
                          isActive && 'hover:text-[var(--primary)] cursor-pointer'
                        )}
                      >
                        {Number(goal.currentValue).toLocaleString('pt-BR')}
                        {isActive && <Edit3 className="w-3 h-3 opacity-60" />}
                      </button>
                    </PermissionGate>
                  )}
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  de {Number(goal.targetValue).toLocaleString('pt-BR')}
                  {goal.unit ? ` ${goal.unit}` : ''}
                </span>
              </div>
            </div>
          ) : null}

          {/* Ações */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Ações
                {goal.actions.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                    {completedCount}/{goal.actions.length}
                  </span>
                )}
              </h3>
            </div>

            {/* Lista de ações */}
            <div className="space-y-0.5 mb-3">
              {goal.actions.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">
                  Nenhuma ação cadastrada. Adicione abaixo.
                </p>
              ) : (
                goal.actions.map((action) => (
                  <GoalActionItem
                    key={action.id}
                    goalId={goal.id}
                    action={action}
                    readOnly={!isActive}
                  />
                ))
              )}
            </div>

            {/* Formulário nova ação */}
            {isActive && (
              <PermissionGate module="goals" action="edit">
                <form onSubmit={handleAddAction} className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newActionTitle}
                    onChange={(e) => setNewActionTitle(e.target.value)}
                    placeholder="Nova ação..."
                    className="flex-1 bg-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  />
                  <button
                    type="submit"
                    disabled={!newActionTitle.trim() || addingAction}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
                  >
                    {addingAction
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Plus className="w-4 h-4" />
                    }
                    Adicionar
                  </button>
                </form>
              </PermissionGate>
            )}
          </div>

          {/* Info rodapé */}
          <div className="text-xs text-[var(--muted-foreground)] border-t border-[var(--border)] pt-4 flex items-center justify-between">
            <span>Criado por {goal.createdBy?.name}</span>
            <span>{format(new Date(goal.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        </div>

        {/* Footer — ações de status */}
        {isActive && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] shrink-0">
            <PermissionGate module="goals" action="edit">
              <button
                onClick={() => handleStatusChange('cancelled')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-orange-500 border border-orange-500/30 hover:bg-orange-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Cancelar Meta
              </button>
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={saving || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />
                }
                Concluir Meta
              </button>
            </PermissionGate>
          </div>
        )}
      </div>
    </div>
  );
}
