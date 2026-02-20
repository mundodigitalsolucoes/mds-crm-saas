// src/components/goals/NewGoalModal.tsx
'use client';

import { useState } from 'react';
import { X, Target, Loader2 } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import type { GoalCreate, GoalType, GoalCategory } from '@/store/goalStore';
import { cn } from '@/lib/utils';

interface NewGoalModalProps {
  open:    boolean;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: GoalType; label: string; desc: string }[] = [
  { value: 'short',  label: 'Curto Prazo',  desc: 'Até 3 meses'  },
  { value: 'medium', label: 'Médio Prazo',  desc: '3 a 12 meses' },
  { value: 'long',   label: 'Longo Prazo',  desc: 'Mais de 1 ano' },
];

const CATEGORY_OPTIONS: { value: GoalCategory; label: string }[] = [
  { value: 'sales',     label: 'Vendas'    },
  { value: 'marketing', label: 'Marketing' },
  { value: 'general',   label: 'Geral'     },
];

export function NewGoalModal({ open, onClose }: NewGoalModalProps) {
  const { createGoal, isLoading, error } = useGoalStore();

  const [form, setForm] = useState<GoalCreate>({
    title:       '',
    description: '',
    type:        'short',
    category:    'general',
    targetValue: null,
    unit:        '',
    startDate:   '',
    deadline:    '',
  });

  function handleChange(field: keyof GoalCreate, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: GoalCreate = {
      ...form,
      description: form.description || undefined,
      targetValue: form.targetValue ?? null,
      unit:        form.unit        || undefined,
      startDate:   form.startDate   || undefined,
      deadline:    form.deadline    || undefined,
    };

    const created = await createGoal(payload);
    if (created) {
      setForm({ title: '', description: '', type: 'short', category: 'general', targetValue: null, unit: '', startDate: '', deadline: '' });
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border)] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--primary)]/10">
              <Target className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Nova Meta</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Defina um objetivo para sua equipe</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ex: Atingir R$ 100k em vendas"
              required
              className="w-full bg-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Descreva o objetivo desta meta..."
              rows={3}
              className="w-full bg-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
              Prazo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange('type', opt.value)}
                  className={cn(
                    'flex flex-col items-center py-3 px-2 rounded-xl border text-center transition-all',
                    form.type === opt.value
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50'
                  )}
                >
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] mt-0.5 opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
              Categoria
            </label>
            <div className="flex gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange('category', opt.value)}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                    form.category === opt.value
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Valor alvo + Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                Valor Alvo
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.targetValue ?? ''}
                onChange={(e) => handleChange('targetValue', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Ex: 100000"
                className="w-full bg-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                Unidade
              </label>
              <input
                type="text"
                value={form.unit ?? ''}
                onChange={(e) => handleChange('unit', e.target.value)}
                placeholder="Ex: reais, leads"
                className="w-full bg-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                Data de Início
              </label>
              <input
                type="date"
                value={form.startDate ?? ''}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="w-full bg-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                Prazo Final
              </label>
              <input
                type="date"
                value={form.deadline ?? ''}
                onChange={(e) => handleChange('deadline', e.target.value)}
                className="w-full bg-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !form.title.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            Criar Meta
          </button>
        </div>
      </div>
    </div>
  );
}
