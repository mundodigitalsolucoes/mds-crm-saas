'use client';

import React, { useState } from 'react';
import { X, Edit as EditIcon, Plus } from 'lucide-react';
import type { OS } from '@/types/os';
import { useOSStore } from '@/store/osStore';
import { useProjectStore } from '@/store/projectStore';
import { LaunchTasksFromOSModal } from '@/components/LaunchTasksFromOSModal';

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

export function OSDetailsModal({ isOpen, onClose, os, onEdit }: OSDetailsModalProps) {
  const { osStages } = useOSStore();
  const { getProjectById } = useProjectStore();
  const [isLaunchTasksOpen, setIsLaunchTasksOpen] = useState(false);

  if (!isOpen || !os) return null;

  const canLaunchTasks = Boolean(os.projetoId);
  const projectName = os.projeto?.title || (os.projetoId ? getProjectById(String(os.projetoId))?.title : undefined) || 'Projeto';
  const currentStage = osStages.find((s) => s.id === os.status);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
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
              {os.descricao && (
                <p className="text-gray-600 mt-1">{os.descricao}</p>
              )}
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
                <p>
                  <span className="font-semibold">Responsável:</span>{' '}
                  {os.responsavelNome || os.responsavel || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Criado por:</span>{' '}
                  {os.criadoPorNome || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Abertura:</span> {formatDate(os.datas?.abertura)}
                </p>
                <p>
                  <span className="font-semibold">Início:</span> {formatDate(os.datas?.inicio)}
                </p>
                <p>
                  <span className="font-semibold">Prazo:</span> {formatDate(os.datas?.prazo)}
                </p>
                {os.datas?.conclusao && (
                  <p>
                    <span className="font-semibold">Conclusão:</span> {formatDate(os.datas.conclusao)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  if (!canLaunchTasks) {
                    alert('Esta OS precisa estar vinculada a um projeto para lançar tarefas.');
                    return;
                  }
                  setIsLaunchTasksOpen(true);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  canLaunchTasks
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!canLaunchTasks}
                type="button"
              >
                <Plus size={20} /> Lançar Tarefas
              </button>

              <button
                onClick={() => {
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

          {/* Status e Progresso */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Status</h3>
              <span
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: currentStage?.color ? `${currentStage.color}20` : '#f3f4f6',
                  color: currentStage?.color || '#374151',
                }}
              >
                {currentStage?.title || os.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${os.progresso || 0}%` }}
                />
              </div>
              <span className="text-lg font-bold text-gray-800">{os.progresso || 0}%</span>
            </div>
          </div>

          {/* Objetivo */}
          {os.objetivos?.principal12m && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Objetivo</h3>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{os.objetivos.principal12m}</p>
            </div>
          )}

          {/* Informação sobre tarefas */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              💡 Para gerenciar tarefas desta OS, acesse o módulo de <strong>Tarefas</strong> no menu lateral
              ou clique em <strong>Lançar Tarefas</strong> para criar novas tarefas vinculadas a este projeto.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            type="button"
          >
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
