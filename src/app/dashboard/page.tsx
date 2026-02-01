'use client';

import Sidebar from '@/components/Sidebar';
import { Search, Bell, Download } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar leads, projetos..."
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
          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total de Leads"
              value="1,248"
              change="+12% este mês"
              positive
            />
            <MetricCard
              title="Taxa de Conversão"
              value="24.5%"
              change="+3.2% vs último mês"
              positive
            />
            <MetricCard
              title="ROI Médio"
              value="R$ 45.2K"
              change="+8.7% este trimestre"
              positive
            />
            <MetricCard
              title="Meta Mensal"
              value="78%"
              change="22% para a meta"
              positive={false}
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-4">Evolução de Leads</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                [Gráfico de Linha - Será implementado]
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-4">Leads por Status</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                [Gráfico Pizza - Será implementado]
              </div>
            </div>
          </div>

          {/* Atividades e Tarefas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-4">Atividades Recentes</h3>
              <div className="space-y-3">
                <Activity
                  icon="📊"
                  text="Maria Santos adicionou um novo lead"
                  company="Tech Solutions"
                  time="há 5 min"
                />
                <Activity
                  icon="✅"
                  text="João Silva converteu lead para"
                  company="Ganho"
                  time="há 15 min"
                />
                <Activity
                  icon="📞"
                  text="Ana Oliveira fez ligação para"
                  company="DataCorp"
                  time="há 1 hora"
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-4">Tarefas Pendentes</h3>
              <div className="space-y-3">
                <Task
                  title="Ligar para Tech Solutions"
                  time="Hoje"
                  priority="Urgente"
                />
                <Task
                  title="Enviar proposta para DataCorp"
                  time="Amanhã"
                  priority="Alta"
                />
                <Task
                  title="Atualizar CRM com novos leads"
                  time="Esta semana"
                  priority="Média"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Componentes auxiliares
function MetricCard({ title, value, change, positive }: any) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-gray-500 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <p className={`text-sm ${positive ? 'text-green-600' : 'text-orange-600'}`}>
        {change}
      </p>
    </div>
  );
}

function Activity({ icon, text, company, time }: any) {
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm text-gray-700">
          {text} <span className="font-medium">{company}</span>
        </p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
}

function Task({ title, time, priority }: any) {
  const colors: any = {
    Urgente: 'bg-red-100 text-red-700',
    Alta: 'bg-orange-100 text-orange-700',
    Média: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
      <input type="checkbox" className="w-4 h-4" />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
      <span className={`text-xs px-2 py-1 rounded ${colors[priority]}`}>
        {priority}
      </span>
    </div>
  );
}
