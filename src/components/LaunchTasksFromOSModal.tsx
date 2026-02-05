// src/components/LaunchTasksFromOSModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore'; // Para usar o addTasks
import type { Task, TaskStatus, TaskPriority } from '@/types/task';

// --- Modal para Lançar Tarefas a partir da OS ---
interface LaunchTasksFromOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  osId: number;
  projectId: number;
  projectName: string;
}

interface TaskFormState {
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
}

export function LaunchTasksFromOSModal({ isOpen, onClose, osId, projectId, projectName }: LaunchTasksFromOSModalProps) {
  const { addTasks } = useTaskStore();
  const [tasksToLaunch, setTasksToLaunch] = useState<TaskFormState[]>([
    { title: '', description: '', assignee: '', dueDate: '', priority: 'media', status: 'nova' },
  ]);

  useEffect(() => {
    if (!isOpen) {
      // Reseta o formulário quando o modal fecha
      setTasksToLaunch([
        { title: '', description: '', assignee: '', dueDate: '', priority: 'media', status: 'nova' },
      ]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTaskChange = (index: number, field: keyof TaskFormState, value: string) => {
    const newTasks = [...tasksToLaunch];
    (newTasks[index] as any)[field] = value; // Asserção de tipo para simplificar
    setTasksToLaunch(newTasks);
  };

  const addTaskField = () => {
    setTasksToLaunch(prev => [
      ...prev,
      { title: '', description: '', assignee: '', dueDate: '', priority: 'media', status: 'nova' },
    ]);
  };

  const removeTaskField = (index: number) => {
    setTasksToLaunch(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validTasks = tasksToLaunch.filter(t => t.title.trim() !== '');

    if (validTasks.length === 0) {
      alert('Adicione pelo menos uma tarefa.');
      return;
    }

    const newTasksData = validTasks.map(task => ({
      title: task.title,
      description: task.description || undefined,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee || undefined,
      dueDate: task.dueDate || undefined,
      projectId: projectId,
      osId: osId,
    }));

    addTasks(newTasksData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Lançar Tarefas para OS #{osId}</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg" type="button">
            <X size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <p className="text-sm text-gray-700">Projeto: <strong>{projectName}</strong></p>

          {tasksToLaunch.map((task, index) => (
            <div key={index} className="border p-4 rounded-lg bg-gray-50 relative">
              {tasksToLaunch.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTaskField(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  title="Remover esta tarefa"
                >
                  <X size={18} />
                </button>
              )}
              <h3 className="font-semibold text-gray-800 mb-3">Tarefa {index + 1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                  <input
                    type="text"
                    value={task.assignee}
                    onChange={(e) => handleTaskChange(index, 'assignee', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea
                    value={task.description}
                    onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                  <input
                    type="date"
                    value={task.dueDate}
                    onChange={(e) => handleTaskChange(index, 'dueDate', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select
                    value={task.priority}
                    onChange={(e) => handleTaskChange(index, 'priority', e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status Inicial</label>
                  <select
                    value={task.status}
                    onChange={(e) => handleTaskChange(index, 'status', e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
                  >
                    <option value="nova">Nova</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          
          <button
            type="button"
            onClick={addTaskField}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Plus size={20} /> Adicionar outra tarefa
          </button>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              Salvar Todas as Tarefas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
