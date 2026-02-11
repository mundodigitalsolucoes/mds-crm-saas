'use client';

import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Edit, X, Plus, Settings, Trash2, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useLeadsStore, type Lead, type Stage } from '@/store/leadsStore';

// ==================== HELPERS ====================

function formatBRL(value: number | null) {
  if (!value) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const COLUMN_COLORS: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50',
  green: 'border-green-200 bg-green-50',
  yellow: 'border-yellow-200 bg-yellow-50',
  orange: 'border-orange-200 bg-orange-50',
  red: 'border-red-200 bg-red-50',
  purple: 'border-purple-200 bg-purple-50',
  gray: 'border-gray-200 bg-gray-50',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  website: 'Website',
  referral: 'Indicação',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  chatwoot: 'Chatwoot',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  csv_import: 'CSV',
};

// ==================== STAGE MODAL ====================

function StageModal({
  isOpen,
  onClose,
  stage,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  stage: Stage | null;
  onSave: (stage: Omit<Stage, 'id'>) => void;
}) {
  const [form, setForm] = useState({ title: '', color: 'blue' });

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      title: stage?.title || '',
      color: stage?.color || 'blue',
    });
  }, [isOpen, stage]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ title: form.title, color: form.color, order: stage?.order ?? 999 });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
          <h2 className="text-lg font-bold text-white">
            {stage ? 'Editar Estágio' : 'Novo Estágio'}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Estágio *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: Qualificado, Proposta, Fechado..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
            <select
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="blue">Azul</option>
              <option value="green">Verde</option>
              <option value="yellow">Amarelo</option>
              <option value="orange">Laranja</option>
              <option value="red">Vermelho</option>
              <option value="purple">Roxo</option>
              <option value="gray">Cinza</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {stage ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== LEAD EDIT MODAL (KANBAN) ====================

function LeadEditModal({
  isOpen,
  onClose,
  lead,
  onSave,
  isSaving,
  availableStatuses,
}: {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSave: (id: string, updates: Partial<Lead>) => void;
  isSaving: boolean;
  availableStatuses: Stage[];
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    source: '',
    status: 'new',
    value: '',
    notes: '',
  });

  useEffect(() => {
    if (!isOpen || !lead) return;
    setForm({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      position: lead.position || '',
      source: lead.source || '',
      status: lead.status || 'new',
      value: lead.value ? String(lead.value) : '',
      notes: lead.notes || '',
    });
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    onSave(lead.id, {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      position: form.position.trim() || null,
      source: form.source || null,
      status: form.status,
      value: form.value ? parseFloat(form.value) : null,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
          <h2 className="text-lg font-bold text-white">Editar Lead</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
              <input
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
              <select
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Selecione...</option>
                <option value="manual">Manual</option>
                <option value="website">Website</option>
                <option value="referral">Indicação</option>
                <option value="meta_ads">Meta Ads</option>
                <option value="google_ads">Google Ads</option>
                <option value="chatwoot">Chatwoot</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estágio</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {availableStatuses.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Observações</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                placeholder="Adicione detalhes importantes sobre este lead..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== KANBAN PAGE ====================

export default function KanbanPage() {
  const {
    leads,
    stages,
    isLoading,
    error,
    fetchLeads,
    updateLead,
    moveLeadInKanban,
    addStage,
    updateStage,
    deleteStage,
  } = useLeadsStore();

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Busca leads ao montar
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Mapa de leads por ID para acesso rápido
  const leadsById = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const l of leads) map.set(l.id, l);
    return map;
  }, [leads]);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return leadsById.get(selectedLeadId) ?? null;
  }, [selectedLeadId, leadsById]);

  // Monta as colunas agrupando leads por status
  const columns = useMemo(() => {
    return stages
      .sort((a, b) => a.order - b.order)
      .map((stage) => {
        const stageLeads = leads.filter((l) => l.status === stage.id);
        const totalValue = stageLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

        return {
          ...stage,
          items: stageLeads,
          totalValue,
        };
      });
  }, [stages, leads]);

  // ==================== DRAG & DROP ====================

  const onDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromStage = source.droppableId;
    const toStage = destination.droppableId;

    // Se não mudou de coluna e mesma posição, nada a fazer
    if (fromStage === toStage && source.index === destination.index) return;

    // Se mudou de coluna, atualiza status via API
    if (fromStage !== toStage) {
      await moveLeadInKanban(draggableId, toStage);
    }
  };

  // ==================== HANDLERS ====================

  const handleCreateStage = () => {
    setSelectedStage(null);
    setShowStageModal(true);
  };

  const handleEditStage = (stage: Stage) => {
    setSelectedStage(stage);
    setShowStageModal(true);
  };

  const handleSaveStage = (stageData: Omit<Stage, 'id'>) => {
    if (selectedStage) {
      updateStage(selectedStage.id, stageData);
    } else {
      addStage({ ...stageData, order: stages.length });
    }
  };

  const handleSaveLead = async (id: string, updates: Partial<Lead>) => {
    setIsSavingLead(true);
    const result = await updateLead(id, updates);
    setIsSavingLead(false);
    if (result) {
      setSelectedLeadId(null);
    }
  };

  // ==================== LOADING STATE ====================

  if (isLoading && leads.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Kanban - Pipeline</h1>
          <p className="text-gray-600">Gerencie seu funil de vendas</p>
        </div>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-indigo-600 mr-3" size={28} />
          <span className="text-gray-600 text-lg">Carregando pipeline...</span>
        </div>
      </div>
    );
  }

  // ==================== RENDER ====================

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Kanban - Pipeline</h1>
          <p className="text-gray-600">
            Gerencie seu funil de vendas •{' '}
            <span className="font-medium">{leads.length} lead(s)</span> •{' '}
            <span className="font-medium text-green-700">
              {formatBRL(leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0))}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchLeads()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={handleCreateStage}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={20} />
            Novo Estágio
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext
        onDragStart={() => setIsDragging(true)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.id} className="min-w-[320px] w-[320px] flex-shrink-0">
              <div className={`bg-white rounded-lg border-2 ${COLUMN_COLORS[col.color] || COLUMN_COLORS.blue}`}>
                {/* Column Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{col.title}</p>
                    <p className="text-xs text-gray-500">
                      {col.items.length} lead(s) • {formatBRL(col.totalValue)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditStage(col)}
                      className="p-1 rounded-md border border-gray-200 hover:bg-gray-50"
                      title="Editar estágio"
                    >
                      <Settings size={14} />
                    </button>
                    {stages.length > 1 && (
                      <button
                        onClick={() => deleteStage(col.id)}
                        className="p-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                        title="Excluir estágio"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 space-y-3 min-h-[120px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-indigo-100/60' : ''
                      }`}
                    >
                      {col.items.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow transition ${
                                snap.isDragging ? 'ring-2 ring-indigo-500 shadow-lg' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-800 truncate">
                                    {lead.name}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {lead.company || '—'}
                                    {lead.position ? ` • ${lead.position}` : ''}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setSelectedLeadId(lead.id)}
                                  className="p-1 rounded-md border border-gray-200 hover:bg-gray-50 flex-shrink-0"
                                  title="Editar lead"
                                >
                                  <Edit size={14} />
                                </button>
                              </div>

                              <div className="mt-2 space-y-1">
                                {lead.email && (
                                  <p className="text-xs text-gray-600 truncate">
                                    <span className="font-medium">Email:</span> {lead.email}
                                  </p>
                                )}
                                {lead.phone && (
                                  <p className="text-xs text-gray-600 truncate">
                                    <span className="font-medium">Tel:</span> {lead.phone}
                                  </p>
                                )}
                                <div className="flex justify-between items-center pt-1">
                                  <p className="text-xs text-gray-600">
                                    <span className="font-medium text-green-700">
                                      {formatBRL(Number(lead.value) || 0)}
                                    </span>
                                  </p>
                                  <div className="flex items-center gap-1">
                                    {lead.source && (
                                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        {SOURCE_LABELS[lead.source] || lead.source}
                                      </span>
                                    )}
                                    {lead.notes && lead.notes.trim().length > 0 && (
                                      <span className="text-gray-400" title={lead.notes}>
                                        <FileText size={14} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Empty state */}
                      {col.items.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center py-6 text-gray-400 text-sm">
                          Arraste leads para cá
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Stage Modal */}
      <StageModal
        isOpen={showStageModal}
        onClose={() => setShowStageModal(false)}
        stage={selectedStage}
        onSave={handleSaveStage}
      />

      {/* Lead Edit Modal */}
      <LeadEditModal
        isOpen={selectedLeadId !== null}
        onClose={() => setSelectedLeadId(null)}
        lead={selectedLead}
        onSave={handleSaveLead}
        isSaving={isSavingLead}
        availableStatuses={stages}
      />
    </div>
  );
}
