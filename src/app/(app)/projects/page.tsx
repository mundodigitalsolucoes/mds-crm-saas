'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Calendar, Clock, Users, DollarSign } from 'lucide-react';
import NewProjectModal from '@/components/NewProjectModal';

interface Project {
  id: number;
  nome: string;
  cliente: string;
  descricao: string;
  status: 'planejamento' | 'em-andamento' | 'pausado' | 'concluido' | 'cancelado';
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  dataInicio: string;
  prazoEntrega: string;
  orcamento: number;
  responsavel: string;
  progresso: number; // 0 a 100
  dataCriacao: string;
}

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const [projects, setProjects] = useState<Project[]>([
    {
      id: 1,
      nome: 'Site Institucional - Empresa Tech',
      cliente: 'Empresa Tech',
      descricao: 'Desenvolvimento de site institucional responsivo com CMS',
      status: 'em-andamento',
      prioridade: 'alta',
      dataInicio: '2025-01-15',
      prazoEntrega: '2025-03-15',
      orcamento: 15000,
      responsavel: 'Fábio Alves',
      progresso: 65,
      dataCriacao: '2025-01-10',
    },
    {
      id: 2,
      nome: 'E-commerce - Caminhões Almiro',
      cliente: 'Caminhões Almiro',
      descricao: 'Plataforma de vendas online para peças de caminhão',
      status: 'planejamento',
      prioridade: 'media',
      dataInicio: '2025-02-01',
      prazoEntrega: '2025-05-01',
      orcamento: 35000,
      responsavel: 'Equipe Dev',
      progresso: 15,
      dataCriacao: '2025-01-25',
    },
  ]);

  // Filtragem dos projetos
  const filteredProjects = useMemo(() => {
    if (!searchQuery) {
      return projects;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return projects.filter(project =>
      project.nome.toLowerCase().includes(lowerCaseQuery) ||
      project.cliente.toLowerCase().includes(lowerCaseQuery) ||
      project.responsavel.toLowerCase().includes(lowerCaseQuery) ||
      project.status.toLowerCase().includes(lowerCaseQuery)
    );
  }, [projects, searchQuery]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedProject(null);
    setShowNewProject(true);
  };

  const openEditModal = (project: Project) => {
    setModalMode('edit');
    setSelectedProject(project);
    setShowNewProject(true);
  };

  const handleCloseModal = () => {
    setShowNewProject(false);
    setSelectedProject(null);
  };

  const handleDeleteProject = (id: number) => {
    const ok = window.confirm('Tem certeza que deseja excluir este projeto?');
    if (!ok) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleModalSubmit = (projectData: any) => {
    if (modalMode === 'edit' && selectedProject) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProject.id
            ? {
                ...p,
                nome: projectData.nome,
                cliente: projectData.cliente,
                descricao: projectData.descricao,
                status: projectData.status,
                prioridade: projectData.prioridade,
                dataInicio: projectData.dataInicio,
                prazoEntrega: projectData.prazoEntrega,
                orcamento: parseFloat(projectData.orcamento) || 0,
                responsavel: projectData.responsavel,
                progresso: parseInt(projectData.progresso) || 0,
              }
            : p
        )
      );
      return;
    }

    // create
    const newProject: Project = {
      id: projects.length ? Math.max(...projects.map((p) => p.id)) + 1 : 1,
      nome: projectData.nome,
      cliente: projectData.cliente,
      descricao: projectData.descricao || '',
      status: projectData.status || 'planejamento',
      prioridade: projectData.prioridade || 'media',
      dataInicio: projectData.dataInicio,
      prazoEntrega: projectData.prazoEntrega,
      orcamento: parseFloat(projectData.orcamento) || 0,
      responsavel: projectData.responsavel || 'Não definido',
      progresso: parseInt(projectData.progresso) || 0,
      dataCriacao: new Date().toISOString().split('T')[0],
    };

    setProjects((prev) => [...prev, newProject]);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      planejamento: 'bg-gray-100 text-gray-800',
      'em-andamento': 'bg-blue-100 text-blue-800',
      pausado: 'bg-yellow-100 text-yellow-800',
      concluido: 'bg-green-100 text-green-800',
      cancelado: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || colors.planejamento;
  };

  const getPriorityColor = (prioridade: string) => {
    const colors = {
      baixa: 'bg-green-100 text-green-800',
      media: 'bg-yellow-100 text-yellow-800',
      alta: 'bg-orange-100 text-orange-800',
      urgente: 'bg-red-100 text-red-800',
    };
    return colors[prioridade as keyof typeof colors] || colors.media;
  };

  const getProgressColor = (progresso: number) => {
    if (progresso >= 80) return 'bg-green-500';
    if (progresso >= 60) return 'bg-blue-500';
    if (progresso >= 40) return 'bg-yellow-500';
    if (progresso >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Projetos</h1>
        <p className="text-gray-600">Gerencie seus projetos e acompanhe o progresso</p>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Users className="text-indigo-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-800">{filteredProjects.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Em Andamento</p>
              <p className="text-2xl font-bold text-blue-600">
                {filteredProjects.filter(p => p.status === 'em-andamento').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Concluídos</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredProjects.filter(p => p.status === 'concluido').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Planejamento</p>
              <p className="text-2xl font-bold text-yellow-600">
                {filteredProjects.filter(p => p.status === 'planejamento').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Orçamento Total</p>
              <p className="text-2xl font-bold text-purple-600">
                R$ {filteredProjects.reduce((acc, p) => acc + p.orcamento, 0).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Projeto</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prioridade</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Progresso</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prazo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Orçamento</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Responsável</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{project.nome}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">{project.descricao}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.cliente}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.prioridade)}`}>
                      {project.prioridade}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getProgressColor(project.progresso)}`}
                          style={{ width: `${project.progresso}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 min-w-[35px]">{project.progresso}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(project.prazoEntrega).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    R$ {project.orcamento.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.responsavel}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(project)}
                        className="px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <NewProjectModal 
        isOpen={showNewProject}
        onClose={handleCloseModal}
        onSubmit={handleModalSubmit}
        mode={modalMode}
        initialData={selectedProject}
      />
    </div>
  );
}
