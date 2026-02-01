'use client';

import Sidebar from '@/components/Sidebar';
import { Search, Bell, Plus, Filter, Calendar, CheckCircle, Circle, Clock } from 'lucide-react';
import { useState } from 'react';

const tasksData = [
  {
    id: 1,
    titulo: 'Finalizar layout do dashboard',
    descricao: 'Ajustar cores e espaçamentos conforme feedback do cliente',
    projeto: 'Website E-commerce',
    prioridade: 'Alta',
    status: 'Em Andamento',
    responsavel: 'Carlos Silva',
    prazo: '05/02/2026',
    concluido: false,
  },
  {
    id: 2,
    titulo: 'Configurar autenticação JWT',
    descricao: 'Implementar login e refresh tokens',
    projeto: 'App Mobile iOS',
    prioridade: 'Alta',
    status: 'Em Andamento',
    responsavel: 'Ana Santos',
    prazo: '08/02/2026',
    concluido: false,
  },
  {
    id: 3,
    titulo: 'Criar documentação da API',
    descricao: 'Documentar todos os endpoints com Swagger',
    projeto: 'Sistema CRM',
    prioridade: 'Média',
    status: 'Pendente',
    responsavel: 'João Oliveira',
    prazo: '12/02/2026',
    concluido: false,
  },
  {
    id: 4,
    titulo: 'Testes de integração',
    descricao: 'Criar suite de testes automatizados',
    projeto: 'Website E-commerce',
    prioridade: 'Média',
    status: 'Pendente',
    responsavel: 'Maria Costa',
    prazo: '15/02/2026',
    concluido: false,
  },
  {
    id: 5,
    titulo: 'Deploy em produção',
    descricao: 'Fazer deploy da versão 1.0',
    projeto: 'Landing Page',
    prioridade: 'Baixa',
    status: 'Concluído',
    responsavel: 'Pedro Alves',
    prazo: '25/01/2026',
    concluido: true,
  },
  {
    id: 6,
    titulo: 'Revisar código do backend',
    descricao: 'Code review das últimas features',
    projeto: 'App Mobile iOS',
    prioridade: 'Alta',
    status: 'Em Andamento',
    responsavel: 'Fábio Alves',
    prazo: '07/02/2026',
    concluido: false,
  },
  {
    id: 7,
    titulo: 'Otimizar queries do banco',
    descricao: 'Melhorar performance das consultas SQL',
    projeto: 'Sistema CRM',
    prioridade: 'Média',
    status: 'Pendente',
    responsavel: 'Lucas Ferreira',
    prazo: '10/02/2026',
    concluido: false,
  },
  {
    id: 8,
    titulo: 'Configurar CI/CD',
    descricao: 'Setup do GitHub Actions',
    projeto: 'Website E-commerce',
    prioridade: 'Baixa',
    status: 'Concluído',
    responsavel: 'Carla Mendes',
    prazo: '20/01/2026',
    concluido: true,
  },
];

export default function TasksPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');

  const prioridadeColors: any = {
    Alta: 'bg-red-100 text-red-700 border-red-300',
    Média: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    Baixa: 'bg-green-100 text-green-700 border-green-300',
  };

  const statusColors: any = {
    Pendente: 'bg-gray-100 text-gray-700',
    'Em Andamento': 'bg-blue-100 text-blue-700',
    Concluído: 'bg-green-100 text-green-700',
  };

  const filteredTasks = filterStatus === 'Todos' 
    ? tasksData 
    : tasksData.filter(task => task.status === filterStatus);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tarefas</h1>
              <p className="text-sm text-gray-500 mt-1">Gerenciamento de tarefas</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar tarefas..."
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
                Nova Tarefa
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
                <strong>{tasksData.length}</strong> tarefas
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6">
            {['Todos', 'Pendente', 'Em Andamento', 'Concluído'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard 
              title="Total de Tarefas" 
              value={tasksData.length.toString()} 
              icon={<Circle size={24} />} 
              color="blue" 
            />
            <StatCard 
              title="Em Andamento" 
              value={tasksData.filter(t => t.status === 'Em Andamento').length.toString()} 
              icon={<Clock size={24} />} 
              color="yellow" 
            />
            <StatCard 
              title="Concluídas" 
              value={tasksData.filter(t => t.concluido).length.toString()} 
              icon={<CheckCircle size={24} />} 
              color="green" 
            />
            <StatCard 
              title="Pendentes" 
              value={tasksData.filter(t => t.status === 'Pendente').length.toString()} 
              icon={<Circle size={24} />} 
              color="gray" 
            />
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                prioridadeColors={prioridadeColors}
                statusColors={statusColors}
              />
            ))}
          </div>
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
    gray: 'bg-gray-50 text-gray-600',
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

function TaskCard({ task, prioridadeColors, statusColors }: any) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={task.concluido}
            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            readOnly
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className={`font-bold text-gray-900 mb-1 ${task.concluido ? 'line-through text-gray-500' : ''}`}>
                {task.titulo}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{task.descricao}</p>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full border ${prioridadeColors[task.prioridade]} ml-3`}>
              {task.prioridade}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[task.status]}`}>
              {task.status}
            </span>
            <span className="text-gray-600">📁 {task.projeto}</span>
            <span className="text-gray-600">👤 {task.responsavel}</span>
            <span className="text-gray-600">📅 {task.prazo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
