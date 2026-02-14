'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Loader2, RefreshCw } from 'lucide-react';
import { useOSStore } from '@/store/osStore';
import { useProjectStore } from '@/store/projectStore';
import type { OS } from '@/types/os';
import { NewOSModal } from '@/components/NewOSModal';
import { OSDetailsModal } from '@/components/OSDetailsModal';

export default function OSPage() {
  const { ordens, deleteOS, fetchOS, loading, error } = useOSStore();
  const { projects, fetchProjects, getProjectById } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOS, setSelectedOS] = useState<OS | null>(null);
  const [showNewOSModal, setShowNewOSModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Carregar OS e projetos do banco ao montar
  useEffect(() => {
    fetchOS();
    fetchProjects();
  }, [fetchOS, fetchProjects]);

  // Helper: buscar nome do projeto pelo ID (string ou number)
  const getProjectName = (projetoId: number | string | undefined): string | undefined => {
    if (!projetoId) return undefined;
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

  const handleDeleteOS = async (id: number | string) => {
    const osToDelete = ordens.find((o) => String(o.id) === String(id));
    const confirmMessage = osToDelete
      ? `Tem certeza que deseja excluir a OS "${osToDelete.codigo}"?`
      : 'Tem certeza que deseja excluir esta OS?';

    if (!window.confirm(confirmMessage)) return;

    setDeleting(String(id));
    try {
      await deleteOS(id);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      em_planejamento: 'bg-blue-100 text-blue-800',
      em_execucao: 'bg-orange-100 text-orange-800',
      aguardando_cliente: 'bg-yellow-100 text-yellow-800',
      em_aprovacao: 'bg-purple-100 text-purple-800',
      pausada: 'bg-gray-100 text-gray-800',
      concluida: 'bg-green-100 text-green-800',
      cancelada: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusDisplay = (status: string) => {
    const labels: Record<string, string> = {
      em_planejamento: 'Em Planejamento',
      em_execucao: 'Em Execução',
      aguardando_cliente: 'Aguardando Cliente',
      concluida: 'Concluída',
      cancelada: 'Cancelada',
    };
    return labels[status] || status.replace(/_/g, ' ');
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
      manutencao: 'Manutenção',
      custom: 'Personalizada',
      outro: 'Outro',
    };
    return tipos[tipo] || tipo;
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      baixa: 'text-green-600',
      media: 'text-yellow-600',
      alta: 'text-red-600',
      urgente: 'text-red-800 font-bold',
    };
    return colors[prioridade] || 'text-gray-600';
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
    // Recarregar lista após criar/editar
    fetchOS();
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Ordens de Serviço</h1>
        <p className="text-gray-600">Gerencie as ordens de serviço dos seus projetos</p>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>❌ {error}</span>
          <button onClick={() => fetchOS()} className="text-red-700 hover:text-red-900 underline text-sm">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar OS por código, título, cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => fetchOS()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            type="button"
            disabled={loading}
            title="Recarregar lista"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

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
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Total de OS</p>
          <p className="text-2xl font-bold text-gray-800">{ordens.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Em Planejamento</p>
          <p className="text-2xl font-bold text-blue-600">
            {ordens.filter((o) => o.status === 'em_planejamento').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Em Execução</p>
          <p className="text-2xl font-bold text-orange-600">
            {ordens.filter((o) => o.status === 'em_execucao').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Aguardando</p>
          <p className="text-2xl font-bold text-yellow-600">
            {ordens.filter((o) => o.status === 'aguardando_cliente').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Concluídas</p>
          <p className="text-2xl font-bold text-green-600">
            {ordens.filter((o) => o.status === 'concluida').length}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading && ordens.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <span className="ml-3 text-gray-600">Carregando ordens de serviço...</span>
        </div>
      )}

      {/* OS Table */}
      {(!loading || ordens.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Título</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Projeto/Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Responsável</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Início</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prazo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Progresso</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {filteredOS.map((os) => (
                  <tr key={String(os.id)} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{os.codigo}</td>

                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{os.titulo}</p>
                        <p className={`text-xs ${getPrioridadeColor(os.prioridade)} capitalize`}>
                          Prioridade {os.prioridade}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>
                        <p className="font-medium">
                          {os.projeto?.title || getProjectName(os.projetoId) ||
                            (os.projetoId ? `Projeto #${os.projetoId}` : 'Sem projeto')}
                        </p>
                        {os.cliente && <p className="text-xs text-gray-500">{os.cliente}</p>}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">{getTipoDisplay(os.tipo)}</td>

                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(os.status)}`}>
                        {getStatusDisplay(os.status)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {os.responsavelNome || os.responsavel || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(os.datas.inicio)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(os.datas.prazo)}</td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${os.progresso || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 min-w-[30px]">{os.progresso || 0}%</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenDetailsModal(os)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                          title="Ver detalhes"
                          type="button"
                        >
                          <Eye size={14} />
                          Ver
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(os)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                          title="Editar OS"
                          type="button"
                        >
                          <Edit size={14} />
                          Editar
                        </button>

                        <button
                          onClick={() => handleDeleteOS(os.id)}
                          disabled={deleting === String(os.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                          title="Excluir OS"
                          type="button"
                        >
                          {deleting === String(os.id) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredOS.length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                      {searchQuery ? 'Nenhuma OS encontrada para a busca.' : 'Nenhuma OS cadastrada ainda. Clique em "Nova OS" para começar.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
