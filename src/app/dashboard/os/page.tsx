'use client';

import Sidebar from '@/components/Sidebar';
import { Search, Bell, Plus, Filter, Download, FileText, Clock, CheckCircle } from 'lucide-react';
import { useState } from 'react';

const osData = [
  {
    id: 1,
    numero: 'OS-2026-001',
    cliente: 'Tech Solutions Ltda',
    servico: 'Desenvolvimento de Website E-commerce',
    status: 'Em Andamento',
    prioridade: 'Alta',
    responsavel: 'Carlos Silva',
    inicio: '15/01/2026',
    previsao: '28/02/2026',
    valor: 'R$ 45.000',
    progresso: 65,
  },
  {
    id: 2,
    numero: 'OS-2026-002',
    cliente: 'DataCorp Brasil',
    servico: 'Desenvolvimento App Mobile iOS',
    status: 'Em Andamento',
    prioridade: 'Alta',
    responsavel: 'Ana Santos',
    inicio: '20/01/2026',
    previsao: '15/03/2026',
    valor: 'R$ 68.000',
    progresso: 40,
  },
  {
    id: 3,
    numero: 'OS-2026-003',
    cliente: 'Marketing Plus',
    servico: 'Implementação Sistema CRM',
    status: 'Aguardando',
    prioridade: 'Média',
    responsavel: 'João Oliveira',
    inicio: '25/01/2026',
    previsao: '30/04/2026',
    valor: 'R$ 92.000',
    progresso: 10,
  },
  {
    id: 4,
    numero: 'OS-2025-089',
    cliente: 'Inovação Tech',
    servico: 'Landing Page Institucional',
    status: 'Concluído',
    prioridade: 'Baixa',
    responsavel: 'Maria Costa',
    inicio: '10/12/2025',
    previsao: '20/01/2026',
    valor: 'R$ 8.500',
    progresso: 100,
  },
  {
    id: 5,
    numero: 'OS-2026-004',
    cliente: 'Digital Pro',
    servico: 'Manutenção e Suporte',
    status: 'Em Andamento',
    prioridade: 'Média',
    responsavel: 'Pedro Alves',
    inicio: '28/01/2026',
    previsao: '28/02/2026',
    valor: 'R$ 15.000',
    progresso: 75,
  },
];

export default function OSPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');

  const statusColors: any = {
    'Aguardando': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'Em Andamento': 'bg-blue-100 text-blue-700 border-blue-300',
    'Pausado': 'bg-orange-100 text-orange-700 border-orange-300',
    'Concluído': 'bg-green-100 text-green-700 border-green-300',
    'Cancelado': 'bg-red-100 text-red-700 border-red-300',
  };

  const prioridadeColors: any = {
    'Alta': 'bg-red-100 text-red-700',
    'Média': 'bg-yellow-100 text-yellow-700',
    'Baixa': 'bg-green-100 text-green-700',
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
              <p className="text-sm text-gray-500 mt-1">Gerenciamento de OS</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar OS..."
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
                Nova OS
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Filter size={20} />
                Filtrar
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Download size={20} />
                Exportar
              </button>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                <strong>{osData.length}</strong> ordens encontradas
              </span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard 
              title="Total de OS" 
              value="45" 
              icon={<FileText size={24} />} 
              color="blue" 
            />
            <StatCard 
              title="Em Andamento" 
              value="18" 
              icon={<Clock size={24} />} 
              color="yellow" 
            />
            <StatCard 
              title="Concluídas" 
              value="24" 
              icon={<CheckCircle size={24} />} 
              color="green" 
            />
            <StatCard 
              title="Faturamento" 
              value="R$ 328K" 
              icon={<Plus size={24} />} 
              color="purple" 
            />
          </div>

          {/* OS Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Número OS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente / Serviço
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prioridade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Responsável
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Progresso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Previsão
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {osData.map((os) => (
                  <tr key={os.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono font-medium text-indigo-600">{os.numero}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{os.cliente}</p>
                        <p className="text-sm text-gray-500">{os.servico}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full border ${statusColors[os.status]}`}>
                        {os.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${prioridadeColors[os.prioridade]}`}>
                        {os.prioridade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{os.responsavel}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-gray-200 rounded-full h-2 max-w-[80px]">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${os.progresso}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600 min-w-[35px]">{os.progresso}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{os.previsao}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{os.valor}</td>
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
