// src/components/goals/GoalCard.tsx
'use client';

import { Target, Calendar, TrendingUp, MoreVertical, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import type { Goal } from '@/store/goalStore';
import { useGoalStore } from '@/store/goalStore';
import { PermissionGate } from '@/components/PermissionGate';

interface GoalCardProps {
  goal:     Goal;
  onOpen:   (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

export function GoalCard({ goal, onOpen, onDelete }: GoalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { getTypeLabel, getCategoryLabel, getStatusLabel, getStatusColor, getCategoryColor, getProgress, completeGoal, updateGoal } = useGoalStore();

  const progress = getProgress(goal);

  function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    completeGoal(goal.id);
    setMenuOpen(false);
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    updateGoal(goal.id, { status: 'cancelled' });
    setMenuOpen(false);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete(goal);
    setMenuOpen(false);
  }

  const completedActions = goal.actions.filter((a) => a.completed).length;
  const totalActions     = goal.actions.length;

  return (
    <div
      onClick={() => onOpen(goal)}
      className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 cursor-pointer hover:border-[var(--primary)] hover:shadow-md transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 p-2 rounded-lg bg-[var(--primary)]/10 shrink-0">
            <Target className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--foreground)] truncate leading-snug">
              {goal.title}
            </h3>
            {goal.description && (
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2 leading-relaxed">
                {goal.description}
              </p>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden py-1">
                {goal.status === 'active' && (
                  <PermissionGate module="goals" action="edit">
                    <button
                      onClick={handleComplete}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-500 hover:bg-[var(--accent)] transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marcar concluída
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-orange-500 hover:bg-[var(--accent)] transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar meta
                    </button>
                  </PermissionGate>
                )}
                <PermissionGate module="goals" action="delete">
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-[var(--accent)] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </PermissionGate>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getCategoryColor(goal.category)}`}>
          {getCategoryLabel(goal.category)}
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]">
          {getTypeLabel(goal.type)}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(goal.status)}`}>
          {getStatusLabel(goal.status)}
        </span>
      </div>

      {/* Progress bar — só exibe se tiver targetValue */}
      {goal.targetValue && goal.targetValue > 0 ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Progresso
            </span>
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-[var(--accent)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:           `${progress}%`,
                backgroundColor: progress >= 100 ? '#22c55e' : 'var(--primary)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {Number(goal.currentValue).toLocaleString('pt-BR')}
              {goal.unit ? ` ${goal.unit}` : ''}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {Number(goal.targetValue).toLocaleString('pt-BR')}
              {goal.unit ? ` ${goal.unit}` : ''}
            </span>
          </div>
        </div>
      ) : null}

      {/* Actions mini-progress */}
      {totalActions > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-0.5 flex-1">
            {goal.actions.slice(0, 10).map((a) => (
              <div
                key={a.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  a.completed ? 'bg-green-500' : 'bg-[var(--accent)]'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
            {completedActions}/{totalActions}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
        <span className="text-[11px] text-[var(--muted-foreground)]">
          {goal.createdBy?.name ?? '—'}
        </span>

        {goal.deadline ? (
          <span className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(goal.deadline), "dd MMM yyyy", { locale: ptBR })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
