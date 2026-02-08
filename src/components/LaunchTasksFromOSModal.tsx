// src/components/LaunchTasksFromOSModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import type { TaskPriority } from '@/types/task';

interface LaunchTasksFromOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  osId: number | string;
  projectId: number | string;
  projectName: string;
}

interface TaskFormState {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
}

export function LaunchTasksFromOSModal({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName 
}: LaunchTasksFromOSModalProps) {
  const { createTask } = useTaskStore();
  const [tasksToLaunch, setTasksToLaunch] = useState<TaskFormState[]>([
    { title: '', description: '', dueDate: '', priority: 'medium' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTasksToLaunch([
        { title: '', description: '', dueDate: '', priority: 'medium' },
      ]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTaskChange = (index: number, field: keyof TaskFormState, value: string) => {
    const newTasks = [...tasksToLaunch];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasksToLaunch(newTasks);
  };

  const addTaskField = () => {
    setTasksToLaunch(prev => [
      ...prev,
      { title: '', description: '', dueDate: '', priority: 'medium' },
    ]);
  };

  const removeTaskField = (index: number) => {
    setTasksToLaunch(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validTasks = tasksToLaunch.filter(t => t.title.trim() !== '');

    if (validTasks.length === 0) {
      alert('Adicione pelo menos uma tarefa com título.');
      return;
    }

    setIsSubmitting(true);

    try {
      for (const task of validTasks) {
        await createTask({
          title: task.title,
          description: task.description || undefined,
          status: 'todo',
          priority: task.priority,
          dueDate: task.dueDate || undefined,
          projectId: String(projectId),
        });
      }
      onClose();
    } catch (error) {
      console.error('Erro ao criar tarefas:', error);
      alert('Erro ao criar tarefas. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Lançar Tarefas</h2>
          <button 
            onClick={onClose} 
            className="text-white hover:bg-white/20 p-1 rounded-lg" 
            type="button"
            disabled={isSubmitting}
          >
            <X size={22} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <p className="text-sm text-gray-700">
            Projeto: <strong>{projectName}</strong>
          </p>

          {tasksToLaunch.map((task, index) => (
            <div key={index} className="border p-4 rounded-lg bg-gray-50 relative">
              {tasksToLaunch.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTaskField(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  title="Remover esta tarefa"
                  disabled={isSubmitting}
                >
                  <X size={18} />
                </button>
              )}
              <h3 className="font-semibold text-gray-800 mb-3">Tarefa {index + 1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Configurar ambiente"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea
                    value={task.description}
                    onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                  <input
                    type="date"
                    value={task.dueDate}
                    onChange={(e) => handleTaskChange(index, 'dueDate', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select
                    value={task.priority}
                    onChange={(e) => handleTaskChange(index, 'priority', e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addTaskField}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <Plus size={20} /> Adicionar outra tarefa
          </button>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Tarefas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
