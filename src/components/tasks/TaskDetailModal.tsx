// src/components/tasks/TaskDetailModal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Folder,
  Flag,
  CheckCircle2,
  Circle,
  Loader2,
  Edit2,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { SubtaskList } from './SubtaskList';
import { CommentSection } from './CommentSection';
import { AttachmentUpload } from './AttachmentUpload';
import type { Task, TaskStatus, TaskPriority } from '@/types/task';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskDetailModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  currentUserId?: string;
}

type TabType = 'details' | 'subtasks' | 'attachments' | 'comments';

export function TaskDetailModal({
  taskId,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  currentUserId,
}: TaskDetailModalProps) {
  const { fetchTaskById, currentTask, updateTask, isLoading, getStatusLabel, getStatusColor, getPriorityLabel, getPriorityColor } = useTaskStore();
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskById(taskId);
    }
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  const task = currentTask;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (task) {
      await updateTask(task.id, { status: newStatus });
    }
  };

  const handlePriorityChange = async (newPriority: TaskPriority) => {
    if (task) {
      await updateTask(task.id, { priority: newPriority });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), "dd 'de' MMM, yyyy", { locale: ptBR });
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'details', label: 'Detalhes' },
    { id: 'subtasks', label: 'Subtarefas', count: task?._count?.subtasks || task?.subtasks?.length || 0 },
    { id: 'attachments', label: 'Anexos', count: task?._count?.attachments || 0 },
    { id: 'comments', label: 'Comentários', count: task?._count?.comments || 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {task && (
              <button
                onClick={() => handleStatusChange(task.status === 'done' ? 'todo' : 'done')}
                className={`p-1 rounded-full transition-colors ${
                  task.status === 'done'
                    ? 'text-green-500 hover:bg-green-50'
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
              >
                {task.status === 'done' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">
              {isLoading ? 'Carregando...' : task?.title || 'Tarefa não encontrada'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {task && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <MoreHorizontal size={20} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border py-1 z-10">
                    {onEdit && (
                      <button
                        onClick={() => {
                          onEdit(task);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        <Edit2 size={16} /> Editar
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => {
                          onDelete(task.id);
                          setShowMenu(false);
                          onClose();
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} /> Excluir
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : !task ? (
            <div className="text-center py-12 text-gray-500">
              Tarefa não encontrada
            </div>
          ) : (
            <>
              {/* Tab: Detalhes */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Descrição */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Descrição</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {task.description || 'Sem descrição'}
                    </p>
                  </div>

                  {/* Grid de informações */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Status */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor(task.status)}`}
                      >
                        <option value="todo">A Fazer</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="done">Concluída</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                    </div>

                    {/* Prioridade */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Prioridade</h3>
                      <select
                        value={task.priority}
                        onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getPriorityColor(task.priority)}`}
                      >
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>

                    {/* Data de vencimento */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <Calendar size={14} /> Data de Vencimento
                      </h3>
                      <p className="text-gray-700">{formatDate(task.dueDate)}</p>
                    </div>

                    {/* Responsável */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <User size={14} /> Responsável
                      </h3>
                      <p className="text-gray-700">{task.assignedTo?.name || 'Não atribuído'}</p>
                    </div>

                    {/* Projeto */}
                    {task.project && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                          <Folder size={14} /> Projeto
                        </h3>
                        <p className="text-gray-700">{task.project.title}</p>
                      </div>
                    )}

                    {/* Tempo estimado */}
                    {task.estimatedMinutes && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                          <Clock size={14} /> Tempo Estimado
                        </h3>
                        <p className="text-gray-700">
                          {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}min
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Datas de criação/conclusão */}
                  <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
                    <p>Criada em {formatDate(task.createdAt)}</p>
                    {task.completedAt && <p>Concluída em {formatDate(task.completedAt)}</p>}
                  </div>
                </div>
              )}

              {/* Tab: Subtarefas */}
              {activeTab === 'subtasks' && (
                <SubtaskList taskId={task.id} subtasks={task.subtasks || []} />
              )}

              {/* Tab: Anexos */}
              {activeTab === 'attachments' && (
                <AttachmentUpload entityType="task" entityId={task.id} />
              )}

              {/* Tab: Comentários */}
              {activeTab === 'comments' && (
                <CommentSection
                  entityType="task"
                  entityId={task.id}
                  currentUserId={currentUserId}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
