// src/components/tasks/SubtaskList.tsx
'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Check } from 'lucide-react';
import type { Subtask, SubtaskCreate } from '@/types/task';
import { useTaskStore } from '@/store/taskStore';

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  readOnly?: boolean;
}

export function SubtaskList({ taskId, subtasks, readOnly = false }: SubtaskListProps) {
  const { addSubtask, updateSubtask, deleteSubtask, toggleSubtask } = useTaskStore();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const completedCount = subtasks.filter((st) => st.completed).length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    await addSubtask(taskId, { title: newSubtaskTitle.trim() });
    setNewSubtaskTitle('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSubtask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewSubtaskTitle('');
    }
  };

  const handleStartEdit = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editingTitle.trim()) return;

    await updateSubtask(taskId, subtaskId, { title: editingTitle.trim() });
    setEditingId(null);
    setEditingTitle('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, subtaskId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(subtaskId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingTitle('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Header com progresso */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Subtarefas ({completedCount}/{subtasks.length})
        </h4>
        {subtasks.length > 0 && (
          <span className="text-xs text-gray-500">{progress}%</span>
        )}
      </div>

      {/* Barra de progresso */}
      {subtasks.length > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Lista de subtarefas */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group"
          >
            {!readOnly && (
              <GripVertical
                size={14}
                className="text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}

            <button
              onClick={() => !readOnly && toggleSubtask(taskId, subtask.id)}
              disabled={readOnly}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                subtask.completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-green-400'
              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {subtask.completed && <Check size={12} />}
            </button>

            {editingId === subtask.id ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => handleEditKeyDown(e, subtask.id)}
                onBlur={() => handleSaveEdit(subtask.id)}
                autoFocus
                className="flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            ) : (
              <span
                onClick={() => !readOnly && handleStartEdit(subtask)}
                className={`flex-1 text-sm ${
                  subtask.completed ? 'line-through text-gray-400' : 'text-gray-700'
                } ${!readOnly ? 'cursor-text' : ''}`}
              >
                {subtask.title}
              </span>
            )}

            {!readOnly && (
              <button
                onClick={() => deleteSubtask(taskId, subtask.id)}
                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Adicionar nova subtarefa */}
      {!readOnly && (
        <>
          {isAdding ? (
            <div className="flex items-center gap-2 p-2">
              <div className="w-5 h-5" /> {/* Spacer */}
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newSubtaskTitle.trim()) {
                    setIsAdding(false);
                  }
                }}
                placeholder="Digite a subtarefa..."
                autoFocus
                className="flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 p-2 text-sm text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-lg w-full"
            >
              <Plus size={16} />
              Adicionar subtarefa
            </button>
          )}
        </>
      )}
    </div>
  );
}
