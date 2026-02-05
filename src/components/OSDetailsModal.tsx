'use client';

import React, { useMemo, useState } from 'react';
import { X, Edit as EditIcon, Plus, Loader2 } from 'lucide-react';
import type { OS } from '@/types/os';
import { useOSStore } from '@/store/osStore';
import { useProjectStore } from '@/store/projectStore';
import { LaunchTasksFromOSModal } from '@/components/LaunchTasksFromOSModal';
import { useTaskStore } from '@/store/taskStore';
import type { Task } from '@/types/task';

interface OSDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  os: OS | null;
  onEdit: (os: OS) => void;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

function TaskChecklistItem({
  task,
  onToggle,
  disabled,
}: {
  task: Task;
  onToggle: (taskId: number) => void;
  disabled?: boolean;
}) {
  const done = task.status === 'concluida';

  return (
    <li className="flex items-center gap-3 text-sm text-gray-800 py-2 border-b last:border-b-0">
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(task.id)}
        disabled={disabled}
        className="w-4 h-4"
      />
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${done ? 'line-through text-gray-500' : ''}`}>{task.title}</p>
        {task.description ? (
          <p className={`text-xs mt-0.5 truncate ${done ? 'text-gray-400' : 'text-gray-500'}`}>{task.description}</p>
        ) : null}
      </div>

      {task.dueDate ? (
        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(task.dueDate)}</span>
      ) : (
        <span className="text-xs text-gray-400 whitespace-nowrap">—</span>
      )}
    </li>
  );
}

export function OSDetailsModal({ isOpen, onClose, os, onEdit }: OSDetailsModalProps) {
  const { calculateProgress } = useOSStore();
  const { getProjectById } = useProjectStore();
  const { getTasksByOS, toggleTaskCompletion } = useTaskStore();

  const [isLaunchTasksOpen, setIsLaunchTasksOpen] = useState(false);
  const [isToggling, setIsToggling] = useState<number | null>(null);

  const osTasks = useMemo(() => {
    if (!os) return [];
    return getTasksByOS(os.id);
  }, [os?.id, getTasksByOS, os]);

  const currentProgress = useMemo(() => {
    if (!os) return 0;
    return calculateProgress(os.id);
  }, [os?.id, calculateProgress, os]);

  if (!isOpen || !os) return null;

  const canLaunchTasks = Boolean(os.projetoId);
  const projectName = os.projetoId ? getProjectById(os.projetoId)?.nome || 'Projeto' : 'Projeto';

  const completedCount = osTasks.filter((t) => t.status === 'concluida').length;
  const totalCount = osTasks.length;

  const handleToggle = (taskId: number) => {
    setIsToggling(taskId);
    try {
      toggleTaskCompletion(taskId);
    } finally {
      setIsToggling(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">Detalhes da OS: {os.codigo}</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg" type="button">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 text-gray-800">
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{os.titulo}</h3>
              <p className="text-gray-600 mt-1">
                Cliente: <span className="font-medium">{os.cliente || 'N/A'}</span>
                {os.projetoId ? (
                  <>
                    {' '}
                    • Projeto: <span className="font-medium">{projectName}</span>
                  </>
                ) : null}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-3 text-gray-600">
                <p><span className="font-semibold">Responsável:</span> {os.responsavel || 'N/A'}</p>
                <p><span className="font-semibold">Abertura:</span> {formatDate(os.datas?.abertura)}</p>
                <p><span className="font-semibold">Início:</span> {formatDate(os.datas?.inicio)}</p>
                <p><span className="font-semibold">Prazo:</span> {formatDate(os.datas?.prazo)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!canLaunchTasks) {
                    alert('Esta OS precisa estar vinculada a um projeto para lançar tarefas.');
                    return;
                  }
                  setIsLaunchTasksOpen(true);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  canLaunchTasks ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!canLaunchTasks}
                type="button"
              >
                <Plus size={20} /> Lançar Tarefas
              </button>

              <button
  onClick={() => {
    // fecha o modal de detalhes antes de abrir o de edição
    onClose();
    setTimeout(() => onEdit(os), 0);
  }}
  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
  type="button"
>
  <EditIcon size={20} /> Editar OS
</button>
            </div>
          </div>

          {/* Progresso baseado em tarefas */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Progresso (Tarefas)</h3>
              <span className="text-sm text-gray-600">
                {completedCount}/{totalCount} concluídas
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${currentProgress}%` }}
                />
              </div>
              <span className="text-lg font-bold text-gray-800">{currentProgress}%</span>
            </div>
          </div>

          {/* Checklist/Tarefas */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-700 text-lg">Checklist / Tarefas</h4>
              <span className="text-sm text-gray-500">{totalCount} itens</span>
            </div>

            {totalCount === 0 ? (
              <div className="text-sm text-gray-600">
                Nenhuma tarefa vinculada ainda. Clique em <strong>Lançar Tarefas</strong>.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {osTasks.map((task) => (
                  <TaskChecklistItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    disabled={isToggling === task.id}
                  />
                ))}
              </ul>
            )}

            {isToggling !== null ? (
              <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Atualizando tarefa...
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600" type="button">
            Fechar
          </button>
        </div>
      </div>

      {canLaunchTasks && os.projetoId && (
        <LaunchTasksFromOSModal
          isOpen={isLaunchTasksOpen}
          onClose={() => setIsLaunchTasksOpen(false)}
          osId={os.id}
          projectId={os.projetoId}
          projectName={projectName}
        />
      )}
    </div>
  );
}
