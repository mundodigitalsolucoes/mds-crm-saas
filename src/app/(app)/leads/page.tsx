'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Upload, Edit, Trash2, Loader2, RefreshCw } from 'lucide-react';
import CSVImport from '@/components/CSVImport';
import NewLeadModal from '@/components/NewLeadModal';
import { useLeadsStore, type Lead } from '@/store/leadsStore';

export default function LeadsPage() {
  const {
    leads,
    stages,
    isLoading,
    error,
    pagination,
    fetchLeads,
    deleteLead,
  } = useLeadsStore();

  const [showImport, setShowImport] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Busca leads ao montar e quando search/page muda
  useEffect(() => {
    fetchLeads({ search: debouncedSearch });
  }, [debouncedSearch, fetchLeads]);

  // Debounce na busca (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedLead(null);
    setShowNewLead(true);
  };

  const openEditModal = (lead: Lead) => {
    setModalMode('edit');
    setSelectedLead(lead);
    setShowNewLead(true);
  };

  const handleDeleteLead = async (lead: Lead) => {
    const confirmMessage = `Tem certeza que deseja excluir o lead "${lead.name}"?`;
    if (!window.confirm(confirmMessage)) return;

    setDeletingId(lead.id);
    await deleteLead(lead.id);
    setDeletingId(null);
  };

  const handleImport = async (data: any[]): Promise<{ success: number; failed: number; errors: string[] }> => {
    const { addLead } = useLeadsStore.getState();
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Aceita campos PT-BR e EN
      const name = row.name || row.nome;
      const email = row.email;

      if (!name) {
        errors.push(`Linha ${i + 2}: Nome é obrigatório`);
        failed++;
        continue;
      }

      const result = await addLead({
        name,
        email: email || null,
        phone: row.phone || row.telefone || null,
        company: row.company || row.empresa || null,
        source: row.source || row.origem || 'csv_import',
        status: row.status || 'new',
      });

      if (result) {
        success++;
      } else {
        errors.push(`Linha ${i + 2}: Erro ao salvar "${name}"`);
        failed++;
      }
    }

    return { success, failed, errors };
  };

  const getStatusDisplay = (status: string) => {
    const stage = stages.find((s) => s.id === status);
    return stage?.title || status;
  };

  const getStatusColor = (status: string) => {
    const stage = stages.find((s) => s.id === status);
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
      purple: 'bg-purple-100 text-purple-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return colorMap[stage?.color || 'blue'] || colorMap.blue;
  };

  const getSourceDisplay = (source: string | null) => {
    const sourceMap: Record<string, string> = {
      manual: 'Manual',
      website: 'Website',
      referral: 'Indicação',
      meta_ads: 'Meta Ads',
      google_ads: 'Google Ads',
      chatwoot: 'Chatwoot',
      instagram: 'Instagram',
      linkedin: 'LinkedIn',
      csv_import: 'Importação CSV',
    };
    return sourceMap[source || ''] || source || '—';
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Leads</h1>
        <p className="text-gray-600">Gerencie seus leads e oportunidades de vendas</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchLeads({ search: debouncedSearch })}
            className="text-red-700 hover:text-red-900 font-medium flex items-center gap-1"
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar leads por nome, email, empresa..."
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-800">{pagination.total}</p>
        </div>
        {stages.map((stage) => (
          <div key={stage.id} className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1 truncate">{stage.title}</p>
            <p className="text-2xl font-bold text-indigo-600">
              {leads.filter((l) => l.status === stage.id).length}
            </p>
          </div>
        ))}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading && leads.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-600 mr-3" size={24} />
            <span className="text-gray-600">Carregando leads...</span>
          </div>
        ) : (
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{lead.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.email || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.phone || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.company || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                        {getStatusDisplay(lead.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{getSourceDisplay(lead.source)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {formatCurrency(lead.value)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
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
                          onClick={() => handleDeleteLead(lead)}
                          disabled={deletingId === lead.id}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                          title="Excluir lead"
                        >
                          {deletingId === lead.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!isLoading && leads.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      {debouncedSearch
                        ? 'Nenhum lead encontrado para a busca.'
                        : 'Nenhum lead cadastrado ainda. Clique em "Novo Lead" para começar.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <span className="text-sm text-gray-600">
              Mostrando {leads.length} de {pagination.total} leads
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLeads({ search: debouncedSearch, page: pagination.page - 1 })}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLeads({ search: debouncedSearch, page: pagination.page + 1 })}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <CSVImport
          isOpen={true}
          entityName="Leads"
          templateFields={['name', 'email', 'phone', 'company', 'status', 'source', 'value']}
          requiredFields={['name']}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* New/Edit Lead Modal */}
      <NewLeadModal
        isOpen={showNewLead}
        onClose={() => {
          setShowNewLead(false);
          setSelectedLead(null);
        }}
        mode={modalMode}
        initialData={selectedLead}
      />
    </div>
  );
}
