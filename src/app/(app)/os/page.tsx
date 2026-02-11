'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useOSStore } from '@/store/osStore';
import { useProjectStore } from '@/store/projectStore';
import type { OS } from '@/types/os';
import { NewOSModal } from '@/components/NewOSModal';
import { OSDetailsModal } from '@/components/OSDetailsModal';

export default function OSPage() {
  const { ordens, deleteOS } = useOSStore();
  const { projects, fetchProjects, getProjectById } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOS, setSelectedOS] = useState<OS | null>(null);
  const [showNewOSModal, setShowNewOSModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Carregar projetos do banco ao montar
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Helper: buscar nome do projeto pelo ID (string ou number)
  const getProjectName = (projetoId: number | string | undefined): string | undefined => {
    if (!projetoId) return undefined;
    // Tenta buscar no store (IDs agora são string/UUID)
    const project = getProjectById(String(projetoId));
    return project?.title;
  };

  const filteredOS = useMemo(() => {
    if (!searchQuery) return ordens;

    const q = searchQuery.toLowerCase();

    return ordens.filter((os) => {
      const projectName = getProjectName(os.projetoId) || '';

      return (
        os.codigo.toLowerCase().includes(q) ||
        os.titulo.toLowerCase().includes(q) ||
        (os.cliente || '').toLowerCase().includes(q) ||
        (os.responsavel || '').toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q)
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordens, searchQuery, projects]);

  const handleDeleteOS = (id: number) => {
    const osToDelete = ordens.find((o) => o.id === id);
    const confirmMessage = osToDelete
      ? `Tem certeza que deseja excluir a OS "${osToDelete.codigo}"?`
      : 'Tem certeza que deseja excluir esta OS?';

    if (!window.confirm(confirmMessage)) return;
    deleteOS(id);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      em_planejamento: 'bg-blue-900/50 text-blue-300 border border-blue-700',
      em_execucao: 'bg-orange-900/50 text-orange-300 border border-orange-700',
      aguardando_cliente: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
      em_aprovacao: 'bg-purple-900/50 text-purple-300 border border-purple-700',
      pausada: 'bg-gray-700/50 text-gray-300 border border-gray-600',
      concluida: 'bg-green-900/50 text-green-300 border border-green-700',
      cancelada: 'bg-red-900/50 text-red-300 border border-red-700',
    };
    return colors[status] || 'bg-gray-700/50 text-gray-300 border border-gray-600';
  };

  const getTipoDisplay = (tipo: string) => {
    const tipos: Record<string, string> = {
      implantacao_mds: 'Implantação MDS',
      campanha_meta_ads: 'Campanha Meta Ads',
      campanha_google_ads: 'Campanha Google Ads',
      otimizacao_gmb: 'Otimização GMB',
      whatsapp_business: 'WhatsApp Business',
      seo_local: 'SEO Local',
      segmentacao_listas: 'Segmentação/Listas',
      fidelizacao: 'Fidelização',
      outro: 'Outro',
    };
    return tipos[tipo] || tipo;
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      baixa: 'text-green-400',
      media: 'text-yellow-400',
      alta: 'text-red-400',
    };
    return colors[prioridade] || 'text-gray-400';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const handleOpenEditModal = (os: OS) => {
    setSelectedOS(os);
    setShowNewOSModal(true);
  };

  const handleCloseNewOSModal = () => {
    setShowNewOSModal(false);
    setSelectedOS(null);
  };

  const handleOpenDetailsModal = (os: OS) => {
    setSelectedOS(os);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedOS(null);
  };

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Ordens de Serviço</h1>
        <p className="text-gray-400">Gerencie as ordens de serviço dos seus projetos</p>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar OS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setSelectedOS(null);
              setShowNewOSModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            type="button"
          >
            <Plus size={20} />
            Nova OS
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Total de OS</p>
          <p className="text-2xl font-bold text-white">{filteredOS.length}</p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Em Planejamento</p>
          <p className="text-2xl font-bold text-blue-400">
            {filteredOS.filter((o) => o.status === 'em_planejamento').length}
          </p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Em Execução</p>
          <p className="text-2xl font-bold text-orange-400">
            {filteredOS.filter((o) => o.status === 'em_execucao').length}
          </p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Aguardando</p>
          <p className="text-2xl font-bold text-yellow-400">
            {filteredOS.filter((o) => o.status === 'aguardando_cliente').length}
          </p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Concluídas</p>
          <p className="text-2xl font-bold text-green-400">
            {filteredOS.filter((o) => o.status === 'concluida').length}
          </p>
        </div>
      </div>

      {/* OS Table */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Código</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Título</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Projeto/Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Responsável</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Início</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Prazo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Progresso</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-700">
              {filteredOS.map((os) => (
                <tr key={os.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-white">{os.codigo}</td>

                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-white truncate max-w-[200px]">{os.titulo}</p>
                      <p className={`text-xs ${getPrioridadeColor(os.prioridade)} capitalize`}>
                        Prioridade {os.prioridade}
                      </p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-300">
                    <div>
                      <p className="font-medium">
                        {getProjectName(os.projetoId) ||
                          (os.projetoId ? `Projeto #${os.projetoId}` : 'Sem projeto')}
                      </p>
                      {os.cliente && <p className="text-xs text-gray-500">{os.cliente}</p>}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-300">{getTipoDisplay(os.tipo)}</td>

                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(os.status)}`}>
                      {os.status.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-300">{os.responsavel || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{formatDate(os.datas.inicio)}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{formatDate(os.datas.prazo)}</td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${os.progresso || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 min-w-[30px]">{os.progresso || 0}%</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenDetailsModal(os)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
                        title="Ver detalhes"
                        type="button"
                      >
                        <Eye size={14} />
                        Ver
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(os)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
                        title="Editar OS"
                        type="button"
                      >
                        <Edit size={14} />
                        Editar
                      </button>

                      <button
                        onClick={() => handleDeleteOS(os.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                        title="Excluir OS"
                        type="button"
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredOS.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'Nenhuma OS encontrada para a busca.' : 'Nenhuma OS cadastrada ainda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New/Edit OS Modal */}
      <NewOSModal isOpen={showNewOSModal} onClose={handleCloseNewOSModal} initialData={selectedOS} />

      {/* OS Details Modal */}
      <OSDetailsModal
        isOpen={showDetailsModal}
        onClose={handleCloseDetailsModal}
        os={selectedOS}
        onEdit={handleOpenEditModal}
      />
    </div>
  );
}
