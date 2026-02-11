'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { OS, OSTipo } from '@/types/os';
import { useOSStore } from '@/store/osStore';
import { useProjectStore } from '@/store/projectStore';
import { LaunchTasksFromOSModal } from '@/components/LaunchTasksFromOSModal';

interface NewOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: OS | null;
}

const getPrioridadeOptions = () =>
  [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
  ] as const;

export function NewOSModal({ isOpen, onClose, initialData }: NewOSModalProps) {
  const { addOS, updateOS, osStages } = useOSStore();
  const { projects, getProjectById } = useProjectStore();

  const [formData, setFormData] = useState<Partial<OS>>({
    tipo: 'implantacao_mds',
    prioridade: 'media',
    status: osStages[0]?.id,
    datas: { abertura: new Date().toISOString().slice(0, 10) },
    objetivos: { principal12m: '', quadrantes: [], metasAlvo: {} },
    orcamento: {},
  });

  // Controle do modal de lançar tarefas
  const [isLaunchTasksOpen, setIsLaunchTasksOpen] = useState(false);

  // Guardamos o ID da OS (após salvar/criar) para poder lançar tarefas
  const [savedOSId, setSavedOSId] = useState<number | null>(null);

  // ✅ hooks sempre rodam
  const projectOptions = useMemo(
  () => projects.map((p) => ({ value: p.id, label: `${p.title} (${p.client || 'Sem cliente'})` })),
  [projects]
);

  const statusOptions = useMemo(
    () => osStages.map((s) => ({ value: s.id, label: s.title })),
    [osStages]
  );

  // ✅ initialize/reset do form quando abre ou quando troca initialData
  useEffect(() => {
    if (!isOpen) return;

    // ao abrir, define o "savedOSId":
    // - se estiver editando, já temos id
    // - se for criação, começa null e só vira id depois de salvar
    setSavedOSId(initialData?.id ?? null);

    if (initialData) {
      setFormData({
        ...initialData,
        datas: initialData.datas || { abertura: new Date().toISOString().slice(0, 10) },
        objetivos: initialData.objetivos || { principal12m: '', quadrantes: [], metasAlvo: {} },
        orcamento: initialData.orcamento || {},
      });
      return;
    }

    setFormData({
      tipo: 'implantacao_mds',
      prioridade: 'media',
      status: osStages[0]?.id,
      datas: { abertura: new Date().toISOString().slice(0, 10) },
      objetivos: { principal12m: '', quadrantes: [], metasAlvo: {} },
      orcamento: {},
    });
  }, [isOpen, initialData, osStages]);

  // ✅ só depois de todos os hooks
  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name.startsWith('datas.')) {
      const key = name.split('.')[1] as keyof NonNullable<OS['datas']>;
      setFormData((prev) => ({
  ...prev,
  datas: {
    abertura: prev.datas?.abertura ?? '',
    inicio: prev.datas?.inicio ?? '',
    prazo: prev.datas?.prazo ?? '',
    conclusao: prev.datas?.conclusao ?? '',
    [key]: value,
  },
}));
      return;
    }

    if (name.startsWith('objetivos.')) {
  const key = name.split('.')[1] as keyof NonNullable<OS['objetivos']>;
  setFormData((prev) => ({
    ...prev,
    objetivos: {
      principal12m: prev.objetivos?.principal12m ?? '',
      quadrantes: prev.objetivos?.quadrantes ?? [],
      metasAlvo: prev.objetivos?.metasAlvo ?? {},
      [key]: value,
    },
  }));
  return;
}

    if (name.startsWith('orcamento.')) {
      const key = name.split('.')[1] as keyof NonNullable<OS['orcamento']>;
      setFormData((prev) => ({ ...prev, orcamento: { ...prev.orcamento, [key]: Number(value) } }));
      return;
    }

    // projetoId geralmente vem como string do select — manter no formData como está e converter no submit
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateAndBuildPayload = () => {
    if (!formData.titulo || !formData.projetoId || !formData.status) {
      alert('Por favor, preencha Título, Projeto e Status.');
      return null;
    }

    const projetoId = String(formData.projetoId);
const project = projects.find((p) => p.id === projetoId);

if (!project) {
  alert('Projeto não encontrado. Selecione um projeto válido.');
  return null;
}

const payload: Omit<OS, 'id'> = {
  codigo: initialData?.codigo || '',
  titulo: formData.titulo,
  projetoId: projetoId,
  leadId: formData.leadId,
  cliente: project.client || '',
      tipo: (formData.tipo || 'implantacao_mds') as OS['tipo'],
      status: String(formData.status),
      prioridade: (formData.prioridade || 'media') as OS['prioridade'],
      responsavel: formData.responsavel,
      participantes: formData.participantes || [],
      datas: {
        abertura: formData.datas?.abertura || new Date().toISOString().slice(0, 10),
        inicio: formData.datas?.inicio,
        prazo: formData.datas?.prazo,
        conclusao: formData.datas?.conclusao,
      },
      objetivos: formData.objetivos as OS['objetivos'],
      orcamento: formData.orcamento as OS['orcamento'],
      pilares: (formData.pilares as OS['pilares']) ?? ({} as OS['pilares']),
      anexos: formData.anexos || [],
      comunicacoes: formData.comunicacoes || [],
      progresso: formData.progresso ?? 0,
    };

    return { payload, project };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = validateAndBuildPayload();
    if (!result) return;

    const { payload } = result;

    if (initialData) {
  updateOS(initialData.id, payload as OS);
  setSavedOSId(initialData.id);
  onClose();
  return;
}

const created = addOS(payload as OS) as unknown as OS;

if (created?.id) {
  setSavedOSId(created.id);
}

// Fecha o modal após criar
onClose();
  };

  const currentProjectId = formData.projetoId ? String(formData.projetoId) : null;
const canLaunchTasks = Boolean(savedOSId && currentProjectId);

const currentProjectName =
  (currentProjectId ? getProjectById(currentProjectId)?.title : undefined) || 'Projeto';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg" type="button">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Dados Gerais</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  name="titulo"
                  value={formData.titulo || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projeto *</label>
                <select
                  name="projetoId"
                  value={formData.projetoId ?? ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Selecione</option>
                  {projectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  name="status"
                  value={(formData.status as string) || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Selecione</option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                <select
                  name="prioridade"
                  value={(formData.prioridade as string) || 'media'}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {getPrioridadeOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                <input
                  type="text"
                  name="responsavel"
                  value={formData.responsavel || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                <input
                  type="date"
                  name="datas.inicio"
                  value={formData.datas?.inicio || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                <input
                  type="date"
                  name="datas.prazo"
                  value={formData.datas?.prazo || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Objetivo</h3>
            <textarea
              name="objetivos.principal12m"
              value={formData.objetivos?.principal12m || ''}
              onChange={handleChange}
              rows={2}
              placeholder="Descreva o objetivo principal desta ordem de serviço..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            {/* Botão lançar tarefas: só habilita quando a OS já foi salva (tem id) e tem projeto */}
            <button
              type="button"
              onClick={() => {
                if (!canLaunchTasks) {
                  alert('Salve a OS e selecione um Projeto antes de lançar tarefas.');
                  return;
                }
                setIsLaunchTasksOpen(true);
              }}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                canLaunchTasks ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canLaunchTasks}
              title={canLaunchTasks ? 'Lançar tarefas vinculadas a esta OS' : 'Salve a OS primeiro'}
            >
              <Plus size={18} />
              Lançar Tarefas
            </button>

            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg">
              Cancelar
            </button>

            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              {initialData ? 'Salvar' : 'Criar OS'}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de lançamento */}
      {savedOSId && currentProjectId && (
        <LaunchTasksFromOSModal
          isOpen={isLaunchTasksOpen}
          onClose={() => setIsLaunchTasksOpen(false)}
          osId={savedOSId}
          projectId={currentProjectId}
          projectName={currentProjectName}
        />
      )}
    </div>
  );
}
