'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Calendar, Clock, Users, DollarSign, Loader2 } from 'lucide-react';
import { useProjectStore, ProjectStatus, ProjectPriority } from '@/store/projectStore';
import NewProjectModal from '@/components/NewProjectModal';

export default function ProjectsPage() {
  const {
    projects,
    loading,
    error,
    fetchProjects,
    addProject,
    updateProject,
    deleteProject,
  } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  // Buscar projetos ao montar e quando busca muda
  useEffect(() => {
    fetchProjects({ search: searchQuery });
  }, [searchQuery, fetchProjects]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedProject(null);
    setShowModal(true);
  };

  const openEditModal = (project: any) => {
    setModalMode('edit');
    setSelectedProject(project);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProject(null);
  };

  const handleDeleteProject = async (id: string) => {
    const ok = window.confirm('Tem certeza que deseja excluir este projeto?');
    if (!ok) return;
    await deleteProject(id);
  };

  const handleModalSubmit = async (formData: any) => {
    // Mapear dados do formulário para a API
    const apiData = {
      title: formData.nome,
      client: formData.cliente || null,
      description: formData.descricao || null,
      status: mapStatusToApi(formData.status),
      priority: mapPriorityToApi(formData.prioridade),
      budget: parseFloat(formData.orcamento) || 0,
      progress: parseInt(formData.progresso) || 0,
      startDate: formData.dataInicio || null,
      endDate: formData.prazoEntrega || null,
    };

    if (modalMode === 'edit' && selectedProject) {
      await updateProject(selectedProject.id, apiData);
    } else {
      await addProject(apiData);
    }
  };

  // Mapear status PT-BR → API (inglês)
  const mapStatusToApi = (status: string): ProjectStatus => {
    const map: Record<string, ProjectStatus> = {
      'planejamento': 'planning',
      'em-andamento': 'active',
      'pausado': 'paused',
      'concluido': 'completed',
      'cancelado': 'cancelled',
    };
    return map[status] || 'planning';
  };

  // Mapear status API → PT-BR (para exibição)
  const mapStatusToLabel = (status: string): string => {
    const map: Record<string, string> = {
      'planning': 'Planejamento',
      'active': 'Em Andamento',
      'paused': 'Pausado',
      'completed': 'Concluído',
      'cancelled': 'Cancelado',
    };
    return map[status] || status;
  };

  // Mapear prioridade PT-BR → API
  const mapPriorityToApi = (priority: string): ProjectPriority => {
    const map: Record<string, ProjectPriority> = {
      'baixa': 'low',
      'media': 'medium',
      'alta': 'high',
      'urgente': 'urgent',
    };
    return map[priority] || 'medium';
  };

  // Mapear prioridade API → PT-BR
  const mapPriorityToLabel = (priority: string): string => {
    const map: Record<string, string> = {
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta',
      'urgent': 'Urgente',
    };
    return map[priority] || priority;
  };

  // Mapear projeto da API → formato do modal (para edição)
  const mapProjectToModal = (project: any) => ({
    ...project,
    nome: project.title,
    cliente: project.client || '',
    descricao: project.description || '',
    status: mapStatusToModalValue(project.status),
    prioridade: mapPriorityToModalValue(project.priority),
    dataInicio: project.startDate ? project.startDate.split('T')[0] : '',
    prazoEntrega: project.endDate ? project.endDate.split('T')[0] : '',
    orcamento: project.budget?.toString() || '0',
    responsavel: project.owner?.name || '',
    progresso: project.progress?.toString() || '0',
  });

  const mapStatusToModalValue = (status: string): string => {
    const map: Record<string, string> = {
      'planning': 'planejamento',
      'active': 'em-andamento',
      'paused': 'pausado',
      'completed': 'concluido',
      'cancelled': 'cancelado',
    };
    return map[status] || 'planejamento';
  };

  const mapPriorityToModalValue = (priority: string): string => {
    const map: Record<string, string> = {
      'low': 'baixa',
      'medium': 'media',
      'high': 'alta',
      'urgent': 'urgente',
    };
    return map[priority] || 'media';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: 'bg-gray-700/50 text-gray-300 border border-gray-600',
      active: 'bg-blue-900/50 text-blue-300 border border-blue-700',
      paused: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
      completed: 'bg-green-900/50 text-green-300 border border-green-700',
      cancelled: 'bg-red-900/50 text-red-300 border border-red-700',
    };
    return colors[status] || colors.planning;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-900/50 text-green-300 border border-green-700',
      medium: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
      high: 'bg-orange-900/50 text-orange-300 border border-orange-700',
      urgent: 'bg-red-900/50 text-red-300 border border-red-700',
    };
    return colors[priority] || colors.medium;
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    if (progress >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // KPIs calculados
  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planning: projects.filter(p => p.status === 'planning').length,
    totalBudget: projects.reduce((acc, p) => acc + (Number(p.budget) || 0), 0),
  }), [projects]);

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Projetos</h1>
        <p className="text-gray-400">Gerencie seus projetos e acompanhe o progresso</p>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar projetos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={20} />
            Novo Projeto
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/50 rounded-lg">
              <Users className="text-indigo-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/50 rounded-lg">
              <Clock className="text-blue-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Em Andamento</p>
              <p className="text-2xl font-bold text-blue-400">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/50 rounded-lg">
              <Calendar className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Concluídos</p>
              <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-900/50 rounded-lg">
              <Clock className="text-yellow-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Planejamento</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.planning}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded-lg">
              <DollarSign className="text-purple-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Orçamento Total</p>
              <p className="text-2xl font-bold text-purple-400">
                R$ {stats.totalBudget.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <span className="ml-3 text-gray-400">Carregando projetos...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-400">Erro: {error}</p>
        </div>
      )}

      {/* Projects Table */}
      {!loading && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Projeto</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Prioridade</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Progresso</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Prazo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Orçamento</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Responsável</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? 'Nenhum projeto encontrado para essa busca.' : 'Nenhum projeto cadastrado. Crie o primeiro!'}
                    </td>
                  </tr>
                ) : (
                  projects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-white">{project.title}</div>
                          <div className="text-sm text-gray-500 max-w-xs truncate">{project.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{project.client || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                          {mapStatusToLabel(project.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority)}`}>
                          {mapPriorityToLabel(project.priority)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getProgressColor(project.progress)}`}
                              style={{ width: `${project.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-400 min-w-[35px]">{project.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {project.endDate
                          ? new Date(project.endDate).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        R$ {Number(project.budget).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{project.owner?.name || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(mapProjectToModal(project))}
                            className="px-3 py-1 text-sm rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            className="px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <NewProjectModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleModalSubmit}
        mode={modalMode}
        initialData={selectedProject}
      />
    </div>
  );
}
