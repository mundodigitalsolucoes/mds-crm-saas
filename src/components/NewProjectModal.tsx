'use client';

import { useEffect, useState } from 'react';
import { X, Calendar, DollarSign, User, FileText } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (project: any) => void;
  initialData?: any | null;
  mode?: 'create' | 'edit';
}

export default function NewProjectModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  mode = 'create',
}: NewProjectModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    cliente: '',
    descricao: '',
    status: 'planejamento',
    prioridade: 'media',
    dataInicio: '',
    prazoEntrega: '',
    orcamento: '',
    responsavel: '',
    progresso: '0',
  });

  // Preenche o form quando abrir em modo edição
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialData) {
      setFormData({
        nome: initialData.nome || '',
        cliente: initialData.cliente || '',
        descricao: initialData.descricao || '',
        status: initialData.status || 'planejamento',
        prioridade: initialData.prioridade || 'media',
        dataInicio: initialData.dataInicio || '',
        prazoEntrega: initialData.prazoEntrega || '',
        orcamento: initialData.orcamento?.toString() || '',
        responsavel: initialData.responsavel || '',
        progresso: initialData.progresso?.toString() || '0',
      });
    }

    if (mode === 'create') {
      setFormData({
        nome: '',
        cliente: '',
        descricao: '',
        status: 'planejamento',
        prioridade: 'media',
        dataInicio: '',
        prazoEntrega: '',
        orcamento: '',
        responsavel: '',
        progresso: '0',
      });
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass =
    'w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">
            {mode === 'edit' ? 'Editar Projeto' : 'Novo Projeto'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações Básicas */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText size={20} className="text-indigo-400" />
                Informações Básicas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome do Projeto *</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    className={inputClass}
                    placeholder="Ex: Site Institucional - Empresa Tech"
                  />
                </div>

                <div>
                  <label className={labelClass}>Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.cliente}
                    onChange={(e) => handleInputChange('cliente', e.target.value)}
                    className={inputClass}
                    placeholder="Nome da empresa/cliente"
                  />
                </div>

                <div>
                  <label className={labelClass}>Responsável</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={formData.responsavel}
                      onChange={(e) => handleInputChange('responsavel', e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="Nome do responsável"
                      disabled
                      title="Responsável é o usuário logado"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Descrição</label>
                  <textarea
                    rows={3}
                    value={formData.descricao}
                    onChange={(e) => handleInputChange('descricao', e.target.value)}
                    className={inputClass}
                    placeholder="Descreva o projeto, objetivos e escopo..."
                  />
                </div>
              </div>
            </div>

            {/* Status e Prioridade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className={inputClass}
                >
                  <option value="planejamento">Planejamento</option>
                  <option value="em-andamento">Em Andamento</option>
                  <option value="pausado">Pausado</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Prioridade</label>
                <select
                  value={formData.prioridade}
                  onChange={(e) => handleInputChange('prioridade', e.target.value)}
                  className={inputClass}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Progresso (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progresso}
                  onChange={(e) => handleInputChange('progresso', e.target.value)}
                  className={inputClass}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Datas e Orçamento */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-blue-400" />
                Cronograma e Orçamento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Data de Início</label>
                  <input
                    type="date"
                    value={formData.dataInicio}
                    onChange={(e) => handleInputChange('dataInicio', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Prazo de Entrega *</label>
                  <input
                    type="date"
                    required
                    value={formData.prazoEntrega}
                    onChange={(e) => handleInputChange('prazoEntrega', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Orçamento (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.orcamento}
                      onChange={(e) => handleInputChange('orcamento', e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="15000.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {mode === 'edit' ? 'Salvar Alterações' : 'Criar Projeto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
