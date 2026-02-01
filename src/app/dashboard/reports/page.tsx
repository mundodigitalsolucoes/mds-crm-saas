'use client';

import Sidebar from '@/components/Sidebar';
import { Search, Bell, Download, Filter, TrendingUp, TrendingDown, DollarSign, Users, Briefcase, Clock } from 'lucide-react';
import { useState } from 'react';

const vendasMensais = [
  { mes: 'Jan', valor: 45000 },
  { mes: 'Fev', valor: 52000 },
  { mes: 'Mar', valor: 48000 },
  { mes: 'Abr', valor: 61000 },
  { mes: 'Mai', valor: 55000 },
  { mes: 'Jun', valor: 67000 },
];

const topClientes = [
  { nome: 'Tech Solutions Ltda', valor: 'R$ 145.000', projetos: 8, crescimento: 12 },
  { nome: 'DataCorp Brasil', valor: 'R$ 132.000', projetos: 6, crescimento: 8 },
  { nome: 'Marketing Plus', valor: 'R$ 98.000', projetos: 5, crescimento: -3 },
  { nome: 'Inovação Tech', valor: 'R$ 87.000', projetos: 4, crescimento: 15 },
  { nome: 'Digital Pro', valor: 'R$ 76.000', projetos: 7, crescimento: 5 },
];

const projetosPorStatus = [
  { status: 'Concluídos', quantidade: 24, percentual: 45, cor: 'bg-green-500' },
  { status: 'Em Andamento', quantidade: 18, percentual: 35, cor: 'bg-blue-500' },
  { status: 'Planejamento', quantidade: 8, percentual: 15, cor: 'bg-yellow-500' },
  { status: 'Pausados', quantidade: 3, percentual: 5, cor: 'bg-red-500' },
];

const equipePerformance = [
  { nome: 'Carlos Silva', projetos: 12, horas: 184, taxa: 98 },
  { nome: 'Ana Santos', projetos: 10, horas: 156, taxa: 95 },
  { nome: 'João Oliveira', projetos: 9, horas: 142, taxa: 92 },
  { nome: 'Maria Costa', projetos: 8, horas: 128, taxa: 90 },
  { nome: 'Pedro Alves', projetos: 7, horas: 118, taxa: 88 },
];

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodo, setPeriodo] = useState('Últimos 6 meses');

  const maxVenda = Math.max(...vendasMensais.map(v => v.valor));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-sm text-gray-500 mt-1">Análises e métricas</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar relatórios..."
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
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option>Últimos 6 meses</option>
                <option>Último ano</option>
                <option>Último trimestre</option>
                <option>Este mês</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Filter size={20} />
                Filtrar
              </button>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Download size={20} />
              Exportar PDF
            </button>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Receita Total"
              value="R$ 524.000"
              change="+12.5%"
              trend="up"
              icon={<DollarSign size={24} />}
              color="green"
            />
            <MetricCard
              title="Novos Clientes"
              value="34"
              change="+8.2%"
              trend="up"
              icon={<Users size={24} />}
              color="blue"
            />
            <MetricCard
              title="Projetos Ativos"
              value="18"
              change="-3.1%"
              trend="down"
              icon={<Briefcase size={24} />}
              color="purple"
            />
            <MetricCard
              title="Horas Trabalhadas"
              value="1.248"
              change="+5.7%"
              trend="up"
              icon={<Clock size={24} />}
              color="orange"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Vendas Mensais */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-gray-900">Vendas Mensais</h3>
                <span className="text-sm text-gray-500">{periodo}</span>
              </div>

              <div className="space-y-4">
                {vendasMensais.map((item) => (
                  <div key={item.mes}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.mes}</span>
                      <span className="text-sm font-bold text-gray-900">
                        R$ {item.valor.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-indigo-600 h-3 rounded-full transition-all"
                        style={{ width: `${(item.valor / maxVenda) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projetos por Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-6">Projetos por Status</h3>

              <div className="space-y-4">
                {projetosPorStatus.map((item) => (
                  <div key={item.status}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${item.cor}`}></div>
                        <span className="text-sm font-medium text-gray-700">{item.status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">{item.quantidade} projetos</span>
                        <span className="text-sm font-bold text-gray-900">{item.percentual}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${item.cor} h-2 rounded-full transition-all`}
                        style={{ width: `${item.percentual}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tables Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Clientes */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="font-bold text-lg text-gray-900">Top Clientes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projetos</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Crescimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {topClientes.map((cliente, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{cliente.nome}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{cliente.valor}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{cliente.projetos}</td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1 text-sm font-medium ${cliente.crescimento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {cliente.crescimento >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {Math.abs(cliente.crescimento)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance da Equipe */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="font-bold text-lg text-gray-900">Performance da Equipe</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membro</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projetos</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taxa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {equipePerformance.map((membro, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{membro.nome}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{membro.projetos}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{membro.horas}h</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${membro.taxa}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{membro.taxa}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ title, value, change, trend, icon, color }: any) {
  const colors: any = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className={`text-sm font-medium flex items-center gap-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {change}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
