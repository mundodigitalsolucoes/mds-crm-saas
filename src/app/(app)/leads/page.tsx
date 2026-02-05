'use client';

import { useMemo, useState } from 'react';
import { Search, Plus, Upload, Edit, Trash2 } from 'lucide-react';
import ImportCSV from '@/components/ImportCSV';
import NewLeadModal from '@/components/NewLeadModal';
import { useLeadsStore } from '@/store/leadsStore';

const CSV_TEMPLATE = `nome,email,telefone,empresa,status,origem
João Silva,joao@email.com,(19) 99999-9999,Empresa A,lead,site
Maria Santos,maria@email.com,(19) 98888-8888,Empresa B,lead,indicação
Pedro Oliveira,pedro@email.com,(19) 97777-7777,Empresa C,lead,google`;

export default function LeadsPage() {
  const { 
    leads, 
    stages,
    addLead, 
    updateLead, 
    deleteLead 
  } = useLeadsStore();

  const [showImport, setShowImport] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  // Filtra os leads com base no termo de busca
  const filteredLeads = useMemo(() => {
    if (!searchQuery) {
      return leads;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return leads.filter(lead =>
      lead.nome.toLowerCase().includes(lowerCaseQuery) ||
      lead.email.toLowerCase().includes(lowerCaseQuery) ||
      lead.empresa.toLowerCase().includes(lowerCaseQuery) ||
      lead.origem.toLowerCase().includes(lowerCaseQuery)
    );
  }, [leads, searchQuery]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedLead(null);
    setShowNewLead(true);
  };

  const openEditModal = (lead: any) => {
    setModalMode('edit');
    setSelectedLead(lead);
    setShowNewLead(true);
  };

  const handleDeleteLead = (id: number) => {
    const leadToDelete = leads.find(l => l.id === id);
    const confirmMessage = leadToDelete 
      ? `Tem certeza que deseja excluir o lead "${leadToDelete.nome}"?`
      : 'Tem certeza que deseja excluir este lead?';
    
    if (!window.confirm(confirmMessage)) return;
    
    deleteLead(id);
  };

  const handleModalSubmit = (leadData: any) => {
    if (modalMode === 'edit' && selectedLead) {
      updateLead(selectedLead.id, leadData);
      return;
    }

    // Criar novo lead com status padrão do primeiro stage
    const defaultStatus = stages[0]?.id || 'lead';
    addLead({
      ...leadData,
      status: leadData.status || defaultStatus,
      dataCriacao: new Date().toISOString().split('T')[0],
    });
  };

  const handleImport = async (data: any[]): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;

    const defaultStatus = stages[0]?.id || 'lead';

    data.forEach((row, index) => {
      if (!row.nome || !row.email) {
        errors.push(`Linha ${index + 2}: Nome e email são obrigatórios`);
        return;
      }

      if (!row.email.includes('@')) {
        errors.push(`Linha ${index + 2}: Email inválido - ${row.email}`);
        return;
      }

      success++;
      addLead({
        nome: row.nome,
        email: row.email,
        telefone: row.telefone || '',
        empresa: row.empresa || '',
        status: row.status || defaultStatus,
        origem: row.origem || 'Importação CSV',
        dataCriacao: new Date().toISOString().split('T')[0],
      });
    });

    return { success, errors };
  };

  const getStatusDisplay = (status: string) => {
    const stage = stages.find(s => s.id === status);
    return stage?.title || status;
  };

  const getStatusColor = (status: string) => {
    const stage = stages.find(s => s.id === status);
    const colorMap = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
      purple: 'bg-purple-100 text-purple-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return colorMap[stage?.color as keyof typeof colorMap] || colorMap.blue;
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={20} />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Stats Cards - dinâmico baseado nos stages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total de Leads</p>
          <p className="text-2xl font-bold text-gray-800">{filteredLeads.length}</p>
        </div>
        {stages.slice(0, 5).map((stage) => (
          <div key={stage.id} className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">{stage.title}</p>
            <p className="text-2xl font-bold text-indigo-600">
              {filteredLeads.filter(l => l.status === stage.id).length}
            </p>
          </div>
        ))}
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{lead.nome}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.telefone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.empresa}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                      {getStatusDisplay(lead.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lead.origem}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(lead.dataCriacao).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(lead)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                        title="Editar lead"
                      >
                        <Edit size={14} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                        title="Excluir lead"
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'Nenhum lead encontrado para a busca.' : 'Nenhum lead cadastrado ainda.'}
                  </td>
                </tr>
              )}
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

      {/* New Lead Modal */}
      <NewLeadModal
        isOpen={showNewLead}
        onClose={() => setShowNewLead(false)}
        onSubmit={handleModalSubmit}
        mode={modalMode}
        initialData={selectedLead}
      />
    </div>
  );
}
