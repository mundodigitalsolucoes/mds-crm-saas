'use client';

import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  Edit,
  X,
  Plus,
  Settings,
  Trash2,
  FileText,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useLeadsStore, type Lead, type Stage } from '@/store/leadsStore';
import { usePermission } from '@/hooks/usePermission';
import AccessDenied from '@/components/AccessDenied';
import PermissionLoading from '@/components/PermissionLoading';

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
  website: 'WebSite',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h2 className="text-lg font-bold text-white">
            {stage ? 'Editar Estágio' : 'Novo Estágio'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white hover:bg-white/20">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nome do Estágio *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Qualificado, Proposta, Fechado..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cor</label>
            <select
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
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
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Editar Lead</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white hover:bg-white/20">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Telefone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Empresa</label>
              <input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Cargo</label>
              <input
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Origem</label>
              <select
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Estágio</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              >
                {availableStatuses.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Notas / Observações</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                placeholder="Adicione detalhes importantes sobre este lead..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
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
  const [, setIsDragging] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const { canAccess, isLoading: permLoading } = usePermission();

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const leadsById = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const l of leads) map.set(l.id, l);
    return map;
  }, [leads]);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return leadsById.get(selectedLeadId) ?? null;
  }, [selectedLeadId, leadsById]);

  const orderedStages = useMemo(() => {
    return [...stages].sort((a, b) => a.order - b.order);
  }, [stages]);

  const pipelineLeads = useMemo(() => {
    return leads.filter((lead) => lead.inKanban);
  }, [leads]);

  const columns = useMemo(() => {
    return orderedStages.map((stage) => {
      const stageLeads = pipelineLeads.filter((l) => l.status === stage.id);
      const totalValue = stageLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      return { ...stage, items: stageLeads, totalValue };
    });
  }, [orderedStages, pipelineLeads]);

  if (permLoading) return <PermissionLoading />;
  if (!canAccess('kanban')) return <AccessDenied module="kanban" />;

  if (isLoading && leads.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold text-gray-800">Kanban - Pipeline</h1>
          <p className="text-gray-600">Gerencie seu funil de vendas</p>
        </div>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="mr-3 animate-spin text-indigo-600" size={28} />
          <span className="text-lg text-gray-600">Carregando pipeline...</span>
        </div>
      </div>
    );
  }

  const onDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromStage = source.droppableId;
    const toStage = destination.droppableId;

    if (fromStage === toStage && source.index === destination.index) return;

    if (fromStage !== toStage) {
      await moveLeadInKanban(draggableId, toStage);
    }
  };

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

  const toggleColumn = (stageId: string) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  const collapseAllColumns = () => {
    const nextState: Record<string, boolean> = {};
    for (const stage of orderedStages) {
      nextState[stage.id] = true;
    }
    setCollapsedColumns(nextState);
  };

  const expandAllColumns = () => {
    setCollapsedColumns({});
  };

  const totalPipelineValue = pipelineLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col p-6">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-800">Kanban - Pipeline</h1>
          <p className="text-gray-600">
            Gerencie seu funil de vendas •{' '}
            <span className="font-medium">{pipelineLeads.length} lead(s) no pipeline</span> •{' '}
            <span className="font-medium text-green-700">{formatBRL(totalPipelineValue)}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={collapseAllColumns}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
          >
            <ChevronsLeft size={18} />
            Recolher colunas
          </button>

          <button
            onClick={expandAllColumns}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
          >
            <ChevronsRight size={18} />
            Expandir colunas
          </button>

          <button
            onClick={() => fetchLeads()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>

          <button
            onClick={handleCreateStage}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700"
          >
            <Plus size={20} />
            Novo Estágio
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
        <span className="font-medium">Dica:</span>
        role o pipeline dentro desta área. Cada coluna agora tem rolagem própria.
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={onDragEnd}>
          <div className="h-full overflow-x-auto overflow-y-hidden pb-2">
            <div className="flex h-full min-w-max gap-4">
              {columns.map((col) => {
                const isCollapsed = collapsedColumns[col.id] === true;

                return (
                  <div
                    key={col.id}
                    className={`h-full flex-shrink-0 transition-all duration-200 ${
                      isCollapsed ? 'w-[88px]' : 'w-[320px]'
                    }`}
                  >
                    <div
                      className={`flex h-full flex-col rounded-lg border-2 ${
                        COLUMN_COLORS[col.color] || COLUMN_COLORS.blue
                      }`}
                    >
                      <div className="border-b border-gray-200 bg-white/90 px-3 py-3 backdrop-blur-sm">
                        <div
                          className={`flex ${
                            isCollapsed ? 'flex-col items-start gap-2' : 'items-start justify-between gap-2'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold text-gray-800 ${isCollapsed ? 'text-xs leading-tight' : ''}`}>
                              {col.title}
                            </p>
                            <p className={`text-gray-500 ${isCollapsed ? 'text-[10px] leading-tight' : 'text-xs'}`}>
                              {col.items.length} lead(s)
                              {!isCollapsed && <> • {formatBRL(col.totalValue)}</>}
                            </p>
                          </div>

                          <div className={`flex ${isCollapsed ? 'w-full flex-col gap-1' : 'gap-1'}`}>
                            <button
                              onClick={() => toggleColumn(col.id)}
                              className="rounded-md border border-gray-200 p-1 hover:bg-gray-50"
                              title={isCollapsed ? 'Expandir coluna' : 'Recolher coluna'}
                            >
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                            </button>

                            {!isCollapsed && (
                              <>
                                <button
                                  onClick={() => handleEditStage(col)}
                                  className="rounded-md border border-gray-200 p-1 hover:bg-gray-50"
                                  title="Editar estágio"
                                >
                                  <Settings size={14} />
                                </button>

                                {stages.length > 1 && (
                                  <button
                                    onClick={() => deleteStage(col.id)}
                                    className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
                                    title="Excluir estágio"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`min-h-0 flex-1 overflow-y-auto transition-colors ${
                              snapshot.isDraggingOver ? 'bg-indigo-100/60' : ''
                            }`}
                          >
                            {isCollapsed ? (
                              <div className="flex h-full min-h-[140px] items-center justify-center p-2 text-center text-[11px] text-gray-500">
                                Clique para expandir
                              </div>
                            ) : (
                              <div className="flex min-h-full flex-col gap-3 p-3">
                                {col.items.map((lead, index) => (
                                  <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                    {(prov, snap) => (
                                      <div
                                        ref={prov.innerRef}
                                        {...prov.draggableProps}
                                        {...prov.dragHandleProps}
                                        className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow ${
                                          snap.isDragging ? 'shadow-lg ring-2 ring-indigo-500' : ''
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-gray-800">
                                              {lead.name}
                                            </p>
                                            <p className="truncate text-xs text-gray-500">
                                              {lead.company || '—'}
                                              {lead.position ? ` • ${lead.position}` : ''}
                                            </p>
                                          </div>

                                          <button
                                            onClick={() => setSelectedLeadId(lead.id)}
                                            className="flex-shrink-0 rounded-md border border-gray-200 p-1 hover:bg-gray-50"
                                            title="Editar lead"
                                          >
                                            <Edit size={14} />
                                          </button>
                                        </div>

                                        <div className="mt-2 space-y-1">
                                          {lead.email && (
                                            <p className="truncate text-xs text-gray-600">
                                              <span className="font-medium">Email:</span> {lead.email}
                                            </p>
                                          )}

                                          {lead.phone && (
                                            <p className="truncate text-xs text-gray-600">
                                              <span className="font-medium">Tel:</span> {lead.phone}
                                            </p>
                                          )}

                                          <div className="flex items-center justify-between pt-1">
                                            <p className="text-xs text-gray-600">
                                              <span className="font-medium text-green-700">
                                                {formatBRL(Number(lead.value) || 0)}
                                              </span>
                                            </p>

                                            <div className="flex items-center gap-1">
                                              {lead.source && (
                                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
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

                                {col.items.length === 0 && !snapshot.isDraggingOver && (
                                  <div className="flex min-h-[120px] flex-1 items-center justify-center text-center text-sm text-gray-400">
                                    Arraste leads para cá
                                  </div>
                                )}
                              </div>
                            )}

                            {isCollapsed && provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      </div>

      <StageModal
        isOpen={showStageModal}
        onClose={() => setShowStageModal(false)}
        stage={selectedStage}
        onSave={handleSaveStage}
      />

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