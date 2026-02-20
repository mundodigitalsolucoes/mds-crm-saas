// src/components/goals/GoalActionItem.tsx
'use client';

import { useState } from 'react';
import { Check, Trash2, GripVertical } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import type { GoalAction } from '@/store/goalStore';
import { PermissionGate } from '@/components/PermissionGate';
import { cn } from '@/lib/utils';

interface GoalActionItemProps {
  goalId:   string;
  action:   GoalAction;
  readOnly?: boolean;
}

export function GoalActionItem({ goalId, action, readOnly = false }: GoalActionItemProps) {
  const { toggleAction, deleteAction } = useGoalStore();
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    if (readOnly) return;
    await toggleAction(goalId, action.id);
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteAction(goalId, action.id);
    setDeleting(false);
  }

  return (
    <div className={cn(
      'flex items-center gap-3 py-2.5 px-3 rounded-lg group',
      'hover:bg-[var(--accent)] transition-colors',
      deleting && 'opacity-50 pointer-events-none'
    )}>
      {/* Drag handle — visual only */}
      {!readOnly && (
        <GripVertical className="w-4 h-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 shrink-0 cursor-grab transition-opacity" />
      )}

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={readOnly}
        className={cn(
          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',
          action.completed
            ? 'bg-green-500 border-green-500'
            : 'border-[var(--border)] hover:border-[var(--primary)]',
          readOnly && 'cursor-default'
        )}
      >
        {action.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Título */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-snug',
          action.completed
            ? 'line-through text-[var(--muted-foreground)]'
            : 'text-[var(--foreground)]'
        )}>
          {action.title}
        </p>
        {action.description && (
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
            {action.description}
          </p>
        )}
      </div>

      {/* Delete */}
      {!readOnly && (
        <PermissionGate module="goals" action="edit">
          <button
            onClick={handleDelete}
            className="p-1 rounded text-[var(--muted-foreground)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </PermissionGate>
      )}
    </div>
  );
}
