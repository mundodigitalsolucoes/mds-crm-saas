'use client';

import Sidebar from '@/components/Sidebar';
import { Search, Bell, Plus, MoreVertical, Calendar, User } from 'lucide-react';
import { useState } from 'react';

const kanbanData = {
  leads: [
    {
      id: 1,
      titulo: 'Tech Solutions Ltda',
      descricao: 'Website institucional + E-commerce',
      valor: 'R$ 45.000',
      contato: 'Carlos Silva',
      prioridade: 'Alta',
      prazo: '15/02/2026',
    },
    {
      id: 2,
      titulo: 'Startup Innovation',
      descricao: 'Landing page + Marketing digital',
      valor: 'R$ 12.000',
      contato: 'Maria Santos',
      prioridade: 'Média',
      prazo: '20/02/2026',
    },
  ],
  contato: [
    {
      id: 3,
      titulo: 'DataCorp Brasil',
      descricao: 'Sistema CRM personalizado',
      valor: 'R$ 89.000',
      contato: 'João Oliveira',
      prioridade: 'Alta',
      prazo: '28/02/2026',
    },
    {
      id: 4,
      titulo: 'Marketing Plus',
      descricao: 'Redesign de site + SEO',
      valor: 'R$ 22.000',
      contato: 'Ana Costa',
      prioridade: 'Baixa',
      prazo: '10/03/2026',
    },
  ],
  proposta: [
    {
      id: 5,
      titulo: 'Inovação Tech',
      descricao: 'App mobile iOS + Android',
      valor: 'R$ 125.000',
      contato: 'Pedro Alves',
      prioridade: 'Alta',
      prazo: '05/03/2026',
    },
  ],
  negociacao: [
    {
      id: 6,
      titulo: 'Digital Systems',
      descricao: 'Portal de notícias + CMS',
      valor: 'R$ 68.000',
      contato: 'Carla Mendes',
      prioridade: 'Média',
      prazo: '15/03/2026',
    },
    {
      id: 7,
      titulo: 'Smart Solutions',
      descricao: 'Sistema de gestão de estoque',
      valor: 'R$ 54.000',
      contato: 'Lucas Ferreira',
      prioridade: 'Média',
      prazo: '20/03/2026',
    },
  ],
  ganho: [
    {
      id: 8,
      titulo: 'Tech Pro',
      descricao: 'Website + Identidade visual',
      valor: 'R$ 32.000',
      contato: 'Beatriz Lima',
      prioridade: 'Alta',
      prazo: '01/02/2026',
    },
  ],
};

const colunas = [
  { id: 'leads', nome: 'Leads', cor: 'bg-blue-500', quantidade: kanbanData.leads.length },
  { id: 'contato', nome: 'Em Contato', cor: 'bg-yellow-500', quantidade: kanbanData.contato.length },
  { id: 'proposta', nome: 'Proposta Enviada', cor: 'bg-purple-500', quantidade: kanbanData.proposta.length },
  { id: 'negociacao', nome: 'Negociação', cor: 'bg-orange-500', quantidade: kanbanData.negociacao.length },
  { id: 'ganho', nome: 'Ganho', cor: 'bg-green-500', quantidade: kanbanData.ganho.length },
];

export default function KanbanPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const prioridadeCores: any = {
    Alta: 'bg-red-100 text-red-700 border-red-300',
    Média: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    Baixa: 'bg-green-100 text-green-700 border-green-300',
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kanban</h1>
              <p className="text-sm text-gray-500 mt-1">Pipeline de vendas</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar oportunidades..."
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
          {/* Stats Summary */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {colunas.map((coluna) => (
              <div key={coluna.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4" style={{ borderColor: coluna.cor.replace('bg-', '#') }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{coluna.nome}</p>
                    <p className="text-2xl font-bold">{coluna.quantidade}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${coluna.cor}`}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {colunas.map((coluna) => (
              <KanbanColumn
                key={coluna.id}
                coluna={coluna}
                cards={(kanbanData as any)[coluna.id]}
                prioridadeCores={prioridadeCores}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function KanbanColumn({ coluna, cards, prioridadeCores }: any) {
  return (
    <div className="flex-shrink-0 w-80 bg-gray-100 rounded-lg p-4">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${coluna.cor}`}></div>
          <h3 className="font-bold text-gray-900">{coluna.nome}</h3>
          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
            {cards.length}
          </span>
        </div>
        <button className="p-1 hover:bg-gray-200 rounded">
          <Plus size={18} />
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {cards.map((card: any) => (
          <KanbanCard key={card.id} card={card} prioridadeCores={prioridadeCores} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ card, prioridadeCores }: any) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-bold text-gray-900 text-sm flex-1">{card.titulo}</h4>
        <button className="p-1 hover:bg-gray-100 rounded">
          <MoreVertical size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{card.descricao}</p>

      {/* Value */}
      <div className="bg-indigo-50 text-indigo-700 font-bold text-sm px-3 py-1.5 rounded mb-3 inline-block">
        {card.valor}
      </div>

      {/* Priority Badge */}
      <div className="mb-3">
        <span className={`text-xs px-2 py-1 rounded-full border ${prioridadeCores[card.prioridade]}`}>
          {card.prioridade}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
        <div className="flex items-center gap-1">
          <User size={14} />
          <span>{card.contato}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          <span>{card.prazo}</span>
        </div>
      </div>
    </div>
  );
}
