'use client';

import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Edit, X, Plus, Settings, Trash2, FileText } from 'lucide-react';
import { useLeadsStore, type Lead, type Stage } from '@/store/leadsStore';

// Adiciona 'notas' opcional à interface Lead para este arquivo,
// caso não esteja na store original ainda.
interface ExtendedLead extends Lead {
  notas?: string;
}

function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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
  const [form, setForm] = useState({
    title: '',
    color: 'blue',
  });

  useMemo(() => {
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
    
    onSave({
      title: form.title,
      color: form.color,
      order: stage?.order ?? 999,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-lg font-bold text-white">
            {stage ? 'Editar Estágio' : 'Novo Estágio'}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Estágio *
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: Qualificado, Proposta, Fechado..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
            <select
              value={form.color}
              onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
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

function LeadEditModal({
  isOpen,
  onClose,
  lead,
  onSave,
  availableStatuses,
}: {
  isOpen: boolean;
  onClose: () => void;
  lead: ExtendedLead | null;
  onSave: (next: ExtendedLead) => void;
  availableStatuses: Stage[];
}) {
  const [form, setForm] = useState<ExtendedLead | null>(lead);

  useMemo(() => {
    if (!isOpen) return;
    setForm(lead);
  }, [isOpen, lead]);

  if (!isOpen || !form) return null;

  const set = (k: keyof ExtendedLead, v: any) => setForm((p) => (p ? { ...p, [k]: v } : p));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
          <h2 className="text-lg font-bold text-white">Editar Lead</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg">
            <X size={22} />
          </button>
        </div>

        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
            onClose();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                required
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <input
                value={form.empresa}
                onChange={(e) => set('empresa', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input
                type="number"
                inputMode="decimal"
                value={form.valor ?? 0}
                onChange={(e) => set('valor', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
              <input
                value={form.origem}
                onChange={(e) => set('origem', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estágio</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {availableStatuses.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.title}
                  </option>
                ))}
              </select>
            </div>
            
            {/* NOVO CAMPO DE NOTAS */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Observações</label>
              <textarea
                value={form.notas || ''}
                onChange={(e) => set('notas', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                placeholder="Adicione detalhes importantes sobre este lead..."
              />
            </div>
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
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const {
    leads,
    stages,
    columnOrder,
    updateLead,
    addStage,
    updateStage,
    deleteStage,
    moveLeadInColumns,
  } = useLeadsStore();

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);

  const leadsById = useMemo(() => {
    const map = new Map<number, ExtendedLead>();
    for (const l of leads) map.set(l.id, l);
    return map;
  }, [leads]);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return leadsById.get(selectedLeadId) ?? null;
  }, [selectedLeadId, leadsById]);

  const columns = useMemo(() => {
    return stages
      .sort((a, b) => a.order - b.order)
      .map((stage) => ({
        ...stage,
        ids: columnOrder[stage.id] || [],
        items: (columnOrder[stage.id] || [])
          .map((id) => leadsById.get(id))
          .filter(Boolean) as ExtendedLead[],
      }));
  }, [stages, columnOrder, leadsById]);

  const getColumnColor = (color: string) => {
    const colors = {
      blue: 'border-blue-200 bg-blue-50',
      green: 'border-green-200 bg-green-50',
      yellow: 'border-yellow-200 bg-yellow-50',
      orange: 'border-orange-200 bg-orange-50',
      red: 'border-red-200 bg-red-50',
      purple: 'border-purple-200 bg-purple-50',
      gray: 'border-gray-200 bg-gray-50',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const from = source.droppableId;
    const to = destination.droppableId;
    const leadId = Number(draggableId);

    moveLeadInColumns(leadId, from, to, destination.index);
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
      addStage({
        ...stageData,
        order: stages.length,
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Kanban - Pipeline</h1>
          <p className="text-gray-600">Gerencie seu funil de vendas</p>
        </div>
        <button
          onClick={handleCreateStage}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={20} />
          Novo Estágio
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.id} className="min-w-[320px] w-[320px]">
              <div className={`bg-white rounded-lg border-2 ${getColumnColor(col.color)}`}>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{col.title}</p>
                    <p className="text-xs text-gray-500">
                      {col.items.length} lead(s) • {formatBRL(col.items.reduce((sum, l) => sum + (l.valor || 0), 0))}
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

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 space-y-3 min-h-[120px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-indigo-100' : ''
                      }`}
                    >
                      {col.items.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={String(lead.id)} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow transition relative ${
                                snap.isDragging ? 'ring-2 ring-indigo-500' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-800 truncate">{lead.nome}</p>
                                  <p className="text-xs text-gray-500 truncate">{lead.empresa || '—'}</p>
                                </div>
                                <button
                                  onClick={() => setSelectedLeadId(lead.id)}
                                  className="p-1 rounded-md border border-gray-200 hover:bg-gray-50"
                                  title="Editar lead"
                                >
                                  <Edit size={14} />
                                </button>
                              </div>

                              <div className="mt-2 space-y-1">
                                <p className="text-xs text-gray-600 truncate">
                                  <span className="font-medium">Email:</span> {lead.email}
                                </p>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-600">
                                    <span className="font-medium">Valor:</span>{' '}
                                    <span className="text-green-700 font-semibold">
                                        {formatBRL(lead.valor || 0)}
                                    </span>
                                    </p>
                                    {/* Ícone de nota se houver */}
                                    {lead.notas && lead.notas.trim().length > 0 && (
                                        <span className="text-gray-400" title="Contém anotações">
                                            <FileText size={16} />
                                        </span>
                                    )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>

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
        onSave={(next) => updateLead(next.id, next)}
        availableStatuses={stages}
      />
    </div>
  );
}
