'use client';

import { useState } from 'react';
import { Search, Plus, Upload } from 'lucide-react';
import ImportCSV from '@/components/ImportCSV';

// Template CSV para download
const CSV_TEMPLATE = `nome,email,telefone,empresa,status,origem
João Silva,joao@email.com,(19) 99999-9999,Empresa A,novo,site
Maria Santos,maria@email.com,(19) 98888-8888,Empresa B,contato,indicação
Pedro Oliveira,pedro@email.com,(19) 97777-7777,Empresa C,qualificado,google`;

interface Lead {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  status: 'novo' | 'contato' | 'qualificado' | 'perdido' | 'convertido';
  origem: string;
  dataCriacao: string;
}

export default function LeadsPage() {
  const [showImport, setShowImport] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: 1,
      nome: 'João Silva',
      email: 'joao@email.com',
      telefone: '(19) 99999-9999',
      empresa: 'Empresa Tech',
      status: 'novo',
      origem: 'Site',
      dataCriacao: '2025-02-01',
    },
  ]);

  const handleImport = async (data: any[]): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;

    const newLeads = data.map((row, index) => {
      // Validações
      if (!row.nome || !row.email) {
        errors.push(`Linha ${index + 2}: Nome e email são obrigatórios`);
        return null;
      }

      if (!row.email.includes('@')) {
        errors.push(`Linha ${index + 2}: Email inválido - ${row.email}`);
        return null;
      }

      success++;
      return {
        id: leads.length + index + 1,
        nome: row.nome,
        email: row.email,
        telefone: row.telefone || '',
        empresa: row.empresa || '',
        status: (row.status || 'novo') as Lead['status'],
        origem: row.origem || 'Importação CSV',
        dataCriacao: new Date().toISOString().split('T')[0],
      };
    }).filter(Boolean) as Lead[];

    setLeads([...leads, ...newLeads]);

    return { success, errors };
  };

  const getStatusColor = (status: string) => {
    const colors = {
      novo: 'bg-blue-100 text-blue-800',
      contato: 'bg-yellow-100 text-yellow-800',
      qualificado: 'bg-green-100 text-green-800',
      perdido: 'bg-red-100 text-red-800',
      convertido: 'bg-purple-100 text-purple-800',
    };
    return colors[status as keyof typeof colors] || colors.novo;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Leads</h1>
        <p className="text-gray-600">Gerencie seus leads e oportunidades de vendas</p>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar leads..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Upload size={20} />
            Importar CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
            <Plus size={20} />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total de Leads</p>
          <p className="text-2xl font-bold text-gray-800">{leads.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Novos</p>
          <p className="text-2xl font-bold text-blue-600">
            {leads.filter(l => l.status === 'novo').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Em Contato</p>
          <p className="text-2xl font-bold text-yellow-600">
            {leads.filter(l => l.status === 'contato').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Qualificados</p>
          <p className="text-2xl font-bold text-green-600">
            {leads.filter(l => l.status === 'qualificado').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Convertidos</p>
          <p className="text-2xl font-bold text-purple-600">
            {leads.filter(l => l.status === 'convertido').length}
          </p>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Empresa</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Origem</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{lead.nome}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.telefone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.empresa}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.origem}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(lead.dataCriacao).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <ImportCSV
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          template={CSV_TEMPLATE}
          templateName="template-leads.csv"
        />
      )}
    </div>
  );
}
