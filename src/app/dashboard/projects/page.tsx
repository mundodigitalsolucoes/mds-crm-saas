'use client';

import Sidebar from '@/components/Sidebar';
import { Search, Bell, Plus, Filter, Calendar, Users, Clock } from 'lucide-react';
import { useState } from 'react';

const projectsData = [
  {
    id: 1,
    nome: 'Website E-commerce',
    cliente: 'Tech Solutions Ltda',
    status: 'Em Andamento',
    progresso: 65,
    inicio: '15/01/2026',
    prazo: '28/02/2026',
    equipe: ['Carlos', 'Ana', 'João'],
    valor: 'R$ 45.000',
  },
  {
    id: 2,
    nome: 'App Mobile - iOS',
    cliente: 'DataCorp Brasil',
    status: 'Em Andamento',
    progresso: 40,
    inicio: '20/01/2026',
    prazo: '15/03/2026',
    equipe: ['Maria', 'Pedro'],
    valor: 'R$ 68.000',
  },
  {
    id: 3,
    nome: 'Sistema CRM Interno',
    cliente: 'Marketing Plus',
    status: 'Planejamento',
    progresso: 10,
    inicio: '25/01/2026',
    prazo: '30/04/2026',
    equipe: ['Fábio', 'Lucas', 'Carla'],
    valor: 'R$ 92.000',
  },
  {
    id: 4,
    nome: 'Landing Page Institucional',
    cliente: 'Inovação Tech',
    status: 'Concluído',
    progresso: 100,
    inicio: '10/12/2025',
    prazo: '20/01/2026',
    equipe: ['Ana'],
    valor: 'R$ 8.500',
  },
];

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid ou list

  const statusColors: any = {
    Planejamento: 'bg-gray-100 text-gray-700 border-gray-300',
    'Em Andamento': 'bg-blue-100 text-blue-700 border-blue-300',
    Pausado: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    Concluído: 'bg-green-100 text-green-700 border-green-300',
    Cancelado: 'bg-red-100 text-red-700 border-red-300',
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar projetos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 hover:bg-gray-100 rounded-lg">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Avatar */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                  F
                </div>
                <span className="text-sm font-medium">Fábio Alves Ramos</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <Plus size={20} />
                Novo Projeto
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Filter size={20} />
                Filtrar
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Calendar size={20} />
                Calendário
              </button>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                <strong>{projectsData.length}</strong> projetos
              </span>
              
              {/* View Toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white'}`}
                >
                  Grade
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white'}`}
                >
                  Lista
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total de Projetos" value="24" icon={<Calendar />} color="blue" />
            <StatCard title="Em Andamento" value="8" icon={<Clock />} color="yellow" />
            <StatCard title="Concluídos" value="14" icon={<Users />} color="green" />
            <StatCard title="Receita Total" value="R$ 524K" icon={<Plus />} color="purple" />
          </div>

          {/* Projects Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectsData.map((project) => (
                <ProjectCard key={project.id} project={project} statusColors={statusColors} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Projeto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Progresso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Prazo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projectsData.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{project.nome}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{project.cliente}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full border ${statusColors[project.status]}`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${project.progresso}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600 min-w-[40px]">{project.progresso}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{project.prazo}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{project.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ProjectCard({ project, statusColors }: any) {
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900 mb-1">{project.nome}</h3>
          <p className="text-sm text-gray-500">{project.cliente}</p>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full border ${statusColors[project.status]}`}>
          {project.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Progresso</span>
          <span className="font-medium text-gray-900">{project.progresso}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${project.progresso}%` }}
          ></div>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={16} />
          <span>Prazo: {project.prazo}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users size={16} />
          <span>{project.equipe.length} membros</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        <span className="font-bold text-indigo-600">{project.valor}</span>
        <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Ver detalhes →
        </button>
      </div>
    </div>
  );
}
