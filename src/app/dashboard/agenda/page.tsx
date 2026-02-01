'use client';

import Sidebar from '@/components/Sidebar';
import { Search, Bell, Plus, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useState } from 'react';

const eventosData = [
  {
    id: 1,
    titulo: 'Reunião com Tech Solutions',
    tipo: 'Reunião',
    horario: '09:00 - 10:30',
    data: '01/02/2026',
    participantes: ['Carlos Silva', 'Ana Santos'],
    descricao: 'Apresentação da proposta de e-commerce',
    cor: 'blue',
  },
  {
    id: 2,
    titulo: 'Demo App Mobile',
    tipo: 'Demonstração',
    horario: '14:00 - 15:00',
    data: '01/02/2026',
    participantes: ['João Oliveira'],
    descricao: 'Mostrar protótipo para o cliente',
    cor: 'purple',
  },
  {
    id: 3,
    titulo: 'Sprint Planning',
    tipo: 'Planejamento',
    horario: '10:00 - 11:30',
    data: '03/02/2026',
    participantes: ['Equipe Dev'],
    descricao: 'Planejamento da sprint #12',
    cor: 'green',
  },
  {
    id: 4,
    titulo: 'Revisão de Código',
    tipo: 'Técnico',
    horario: '15:00 - 16:00',
    data: '03/02/2026',
    participantes: ['Pedro Alves', 'Maria Costa'],
    descricao: 'Code review das features desenvolvidas',
    cor: 'orange',
  },
  {
    id: 5,
    titulo: 'Almoço com Cliente',
    tipo: 'Comercial',
    horario: '12:30 - 14:00',
    data: '05/02/2026',
    participantes: ['Fábio Alves'],
    descricao: 'Negociação novo projeto',
    cor: 'red',
  },
  {
    id: 6,
    titulo: 'Workshop de Design',
    tipo: 'Treinamento',
    horario: '09:00 - 12:00',
    data: '06/02/2026',
    participantes: ['Equipe Design'],
    descricao: 'Novidades do Figma',
    cor: 'pink',
  },
  {
    id: 7,
    titulo: 'Daily Standup',
    tipo: 'Reunião',
    horario: '09:30 - 09:45',
    data: '07/02/2026',
    participantes: ['Todo time'],
    descricao: 'Daily diária da equipe',
    cor: 'blue',
  },
];

const tiposEvento = [
  { nome: 'Reunião', cor: 'bg-blue-500' },
  { nome: 'Demonstração', cor: 'bg-purple-500' },
  { nome: 'Planejamento', cor: 'bg-green-500' },
  { nome: 'Técnico', cor: 'bg-orange-500' },
  { nome: 'Comercial', cor: 'bg-red-500' },
  { nome: 'Treinamento', cor: 'bg-pink-500' },
];

export default function AgendaPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [mesAtual, setMesAtual] = useState('Fevereiro 2026');
  const [viewMode, setViewMode] = useState('semana'); // semana, mes, dia

  const corEventos: any = {
    blue: 'bg-blue-100 border-blue-500 text-blue-700',
    purple: 'bg-purple-100 border-purple-500 text-purple-700',
    green: 'bg-green-100 border-green-500 text-green-700',
    orange: 'bg-orange-100 border-orange-500 text-orange-700',
    red: 'bg-red-100 border-red-500 text-red-700',
    pink: 'bg-pink-100 border-pink-500 text-pink-700',
  };

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
              <p className="text-sm text-gray-500 mt-1">Calendário e eventos</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar eventos..."
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
                Novo Evento
              </button>
              
              {/* View Mode Toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('dia')}
                  className={`px-4 py-2 text-sm ${viewMode === 'dia' ? 'bg-indigo-600 text-white' : 'bg-white'}`}
                >
                  Dia
                </button>
                <button
                  onClick={() => setViewMode('semana')}
                  className={`px-4 py-2 text-sm border-x ${viewMode === 'semana' ? 'bg-indigo-600 text-white' : 'bg-white'}`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setViewMode('mes')}
                  className={`px-4 py-2 text-sm ${viewMode === 'mes' ? 'bg-indigo-600 text-white' : 'bg-white'}`}
                >
                  Mês
                </button>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </button>
              <span className="font-bold text-lg">{mesAtual}</span>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Eventos Este Mês" value="24" color="blue" />
            <StatCard title="Reuniões" value="12" color="green" />
            <StatCard title="Hoje" value="3" color="purple" />
            <StatCard title="Próximos 7 dias" value="8" color="orange" />
          </div>

          {/* Layout: Calendar + Events List */}
          <div className="grid grid-cols-3 gap-6">
            {/* Mini Calendar */}
            <div className="col-span-1">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold text-gray-900 mb-4">Fevereiro 2026</h3>
                
                {/* Weekdays */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {diasSemana.map((dia) => (
                    <div key={dia} className="text-xs font-medium text-gray-500 text-center">
                      {dia}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                    <button
                      key={dia}
                      className={`
                        aspect-square flex items-center justify-center text-sm rounded-lg
                        ${dia === 1 ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-gray-100'}
                      `}
                    >
                      {dia}
                    </button>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-6 space-y-2">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">Tipos de Evento</h4>
                  {tiposEvento.map((tipo) => (
                    <div key={tipo.nome} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${tipo.cor}`}></div>
                      <span className="text-sm text-gray-600">{tipo.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Events List */}
            <div className="col-span-2 space-y-4">
              {eventosData.map((evento) => (
                <EventoCard key={evento.id} evento={evento} corEventos={corEventos} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, color }: any) {
  const colors: any = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}

function EventoCard({ evento, corEventos }: any) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 p-4 hover:shadow-md transition-shadow ${corEventos[evento.cor]}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">{evento.data}</span>
            <span className="text-sm font-medium text-gray-900">• {evento.horario}</span>
          </div>
          <h3 className="font-bold text-lg text-gray-900 mb-1">{evento.titulo}</h3>
          <p className="text-sm text-gray-600 mb-2">{evento.descricao}</p>
        </div>
        <span className={`px-3 py-1 text-xs rounded-full font-medium ${corEventos[evento.cor]}`}>
          {evento.tipo}
        </span>
      </div>

      {/* Participantes */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">Participantes:</span>
        <span>{evento.participantes.join(', ')}</span>
      </div>
    </div>
  );
}
