// src/components/tasks/TaskFormModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Flag, User, Folder, Link } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  initialData?: Partial<TaskFormData>;
  mode: 'create' | 'edit';
}

export interface TaskFormData {
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  startDate?: string;
  estimatedMinutes?: number;
  projectId?: string;
  leadId?: string;
  assignedToId?: string;
}

const priorityOptions = [
  { value: 'low', label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Média', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-700' },
];

const statusOptions = [
  { value: 'todo', label: 'A Fazer' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'done', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
];

export function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: TaskFormModalProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
    startDate: '',
    estimatedMinutes: undefined,
    projectId: '',
    leadId: '',
    assignedToId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Resetar form quando o modal abre/fecha ou muda o modo
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title || '',
          description: initialData.description || '',
          status: initialData.status || 'todo',
          priority: initialData.priority || 'medium',
          dueDate: initialData.dueDate || '',
          startDate: initialData.startDate || '',
          estimatedMinutes: initialData.estimatedMinutes,
          projectId: initialData.projectId || '',
          leadId: initialData.leadId || '',
          assignedToId: initialData.assignedToId || '',
        });
      } else {
        // Reset completo para nova tarefa
        setFormData({
          title: '',
          description: '',
          status: 'todo',
          priority: 'medium',
          dueDate: '',
          startDate: '',
          estimatedMinutes: undefined,
          projectId: '',
          leadId: '',
          assignedToId: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Título é obrigatório';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Limpar campos vazios antes de enviar — evita erro de Zod UUID
  const cleanFormData = (data: TaskFormData): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {
      title: data.title.trim(),
      status: data.status,
      priority: data.priority,
    };

    // Só enviar campos que têm valor
    if (data.description?.trim()) cleaned.description = data.description.trim();
    if (data.dueDate) cleaned.dueDate = data.dueDate;
    if (data.startDate) cleaned.startDate = data.startDate;
    if (data.estimatedMinutes) cleaned.estimatedMinutes = Number(data.estimatedMinutes);
    if (data.projectId) cleaned.projectId = data.projectId;
    if (data.leadId) cleaned.leadId = data.leadId;
    if (data.assignedToId) cleaned.assignedToId = data.assignedToId;

    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Limpar dados antes de enviar
      const cleanedData = cleanFormData(formData);
      await onSubmit(cleanedData as any);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
      setErrors({ title: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'Nova Tarefa' : 'Editar Tarefa'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-5">
              {/* Título */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Título *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={`w-full rounded-lg border px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Digite o título da tarefa"
                  autoFocus
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-500">{errors.title}</p>
                )}
              </div>

              {/* Descrição */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Descrição
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descreva os detalhes da tarefa"
                />
              </div>

              {/* Status e Prioridade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="priority"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Prioridade
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="startDate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Data de Início
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dueDate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    id="dueDate"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Tempo Estimado */}
              <div>
                <label
                  htmlFor="estimatedMinutes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  <Clock className="inline h-4 w-4 mr-1" />
                  Tempo Estimado (minutos)
                </label>
                <input
                  type="number"
                  id="estimatedMinutes"
                  name="estimatedMinutes"
                  value={formData.estimatedMinutes || ''}
                  onChange={handleChange}
                  min="0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 60"
                />
              </div>
            </div>

            {/* Botões */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Criar Tarefa' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
