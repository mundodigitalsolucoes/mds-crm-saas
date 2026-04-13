// src/components/NewLeadModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useLeadsStore, type Lead } from '@/store/leadsStore';
import { useUsage } from '@/hooks/useUsage';
import LimitAlert from '@/components/LimitAlert';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: Lead | null;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  status: string;
  source: string;
  value: string;
  notes: string;
  inKanban: boolean;
}

const emptyForm: FormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  position: '',
  status: 'new',
  source: '',
  value: '',
  notes: '',
  inKanban: true,
};

export default function NewLeadModal({
  isOpen,
  onClose,
  mode = 'create',
  initialData = null,
}: NewLeadModalProps) {
  const { addLead, updateLead, stages } = useLeadsStore();
  const { isAtLimit, isPlanInactive, formatUsage, data: usageData } = useUsage();

  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvSendToKanban, setCsvSendToKanban] = useState(true);
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'importing' | 'success' | 'error'>('idle');
  const [importResults, setImportResults] = useState({ success: 0, errors: 0, total: 0 });

  // ✅ Verificar limite (só bloqueia criação, edição sempre OK)
  const limitReached = mode === 'create' && (isAtLimit('leads') || isPlanInactive());

  // Preenche/reseta form ao abrir
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialData) {
      setActiveTab('manual');
      setFormData({
        name: initialData.name ?? '',
        email: initialData.email ?? '',
        phone: initialData.phone ?? '',
        company: initialData.company ?? '',
        position: initialData.position ?? '',
        status: initialData.status ?? 'new',
        source: initialData.source ?? '',
        value: initialData.value ? String(initialData.value) : '',
        notes: initialData.notes ?? '',
        inKanban: initialData.inKanban ?? true,
      });
    } else {
      setActiveTab('manual');
      setFormData(emptyForm);
    }

    setFormError(null);
    setIsSaving(false);
    setCsvFile(null);
    setCsvData([]);
    setCsvSendToKanban(true);
    setImportStatus('idle');
    setImportResults({ success: 0, errors: 0, total: 0 });
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (limitReached) return;

    if (!formData.name.trim()) {
      setFormError('Nome é obrigatório');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        company: formData.company.trim() || null,
        position: formData.position.trim() || null,
        status: formData.status,
        source: formData.source.trim() || 'manual',
        value: formData.value ? parseFloat(formData.value) : null,
        notes: formData.notes.trim() || null,
        inKanban: formData.inKanban,
      };

      let result;
      if (mode === 'edit' && initialData) {
        result = await updateLead(initialData.id, payload);
      } else {
        result = await addLead(payload);
      }

      if (result) {
        onClose();
      } else {
        setFormError('Erro ao salvar lead. Tente novamente.');
      }
    } catch {
      setFormError('Erro inesperado ao salvar lead.');
    } finally {
      setIsSaving(false);
    }
  };

  // ==================== CSV ====================

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        alert('CSV inválido! Deve conter pelo menos o cabeçalho e uma linha de dados.');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const data: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const name = row.name || row.nome || '';
        const email = row.email || '';

        if (name) {
          data.push({
            name,
            email: email || null,
            phone: row.phone || row.telefone || null,
            company: row.company || row.empresa || null,
            source: row.source || row.origem || 'csv_import',
            status: row.status || 'new',
            value: row.value || row.valor || null,
          });
        }
      }

      setCsvData(data);
      setImportStatus('preview');
      setImportResults({ success: 0, errors: 0, total: data.length });
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (limitReached) return;

    setImportStatus('importing');
    let successCount = 0;
    let errorCount = 0;

    for (const lead of csvData) {
      const result = await addLead({
        ...lead,
        inKanban: csvSendToKanban,
      });

      if (result) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    setImportResults({ success: successCount, errors: errorCount, total: csvData.length });
    setImportStatus('success');

    setTimeout(() => {
      resetCsvImport();
      onClose();
    }, 3000);
  };

  const resetCsvImport = () => {
    setCsvFile(null);
    setCsvData([]);
    setCsvSendToKanban(true);
    setImportStatus('idle');
    setImportResults({ success: 0, errors: 0, total: 0 });
  };

  const downloadTemplate = () => {
    const template =
      'name,email,phone,company,status,source,value\nJoão Silva,joao@email.com,(19) 99999-9999,Empresa A,new,website,2500\nMaria Santos,maria@email.com,(19) 98888-8888,Empresa B,contacted,referral,5000';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-leads.csv';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">
            {mode === 'edit' ? 'Editar Lead' : 'Adicionar Leads'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white transition-colors hover:bg-white/20">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'manual'
                ? 'border-b-2 border-indigo-600 bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="mr-2 inline" size={18} />
            Manual
          </button>
          <button
            disabled={mode === 'edit'}
            onClick={() => (mode === 'edit' ? null : setActiveTab('csv'))}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              mode === 'edit'
                ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                : activeTab === 'csv'
                  ? 'border-b-2 border-indigo-600 bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Upload className="mr-2 inline" size={18} />
            Importar CSV
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {limitReached && (
            <LimitAlert
              resource="leads"
              usage={formatUsage('leads')}
              planName={usageData?.plan}
            />
          )}

          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  <AlertCircle size={18} />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    placeholder="João Silva"
                    disabled={limitReached}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    placeholder="joao@email.com"
                    disabled={limitReached}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Telefone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    placeholder="(19) 99999-9999"
                    disabled={limitReached}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Empresa</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    placeholder="Empresa Exemplo"
                    disabled={limitReached}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Cargo</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    placeholder="Diretor Comercial"
                    disabled={limitReached}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    disabled={limitReached}
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Origem</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    disabled={limitReached}
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    placeholder="5000.00"
                    disabled={limitReached}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.inKanban}
                    onChange={(e) => setFormData({ ...formData, inKanban: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={limitReached}
                  />
                  <div>
                    <p className="font-medium text-indigo-900">Enviar para o pipeline agora</p>
                    <p className="text-sm text-indigo-700">
                      Desmarcado, o lead será salvo na base e ficará fora do Kanban.
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                  placeholder="Notas sobre o lead..."
                  disabled={limitReached}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || limitReached}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSaving && <Loader2 size={18} className="animate-spin" />}
                  {limitReached
                    ? 'Limite Atingido'
                    : mode === 'edit'
                      ? 'Salvar Alterações'
                      : 'Adicionar Lead'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Download Template */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Download className="mt-0.5 flex-shrink-0 text-blue-600" size={20} />
                  <div className="flex-1">
                    <h3 className="mb-1 font-medium text-blue-900">Baixar Template CSV</h3>
                    <p className="mb-3 text-sm text-blue-700">
                      Use nosso template para garantir que seu CSV está no formato correto.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                    >
                      Baixar Template
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={csvSendToKanban}
                    onChange={(e) => setCsvSendToKanban(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={limitReached}
                  />
                  <div>
                    <p className="font-medium text-indigo-900">Enviar leads importados para o pipeline agora</p>
                    <p className="text-sm text-indigo-700">
                      Desmarcado, os leads serão importados na base e ficarão fora do Kanban.
                    </p>
                  </div>
                </label>
              </div>

              {/* Upload Area */}
              {importStatus === 'idle' && (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-indigo-400">
                  <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                  <label className={`cursor-pointer ${limitReached ? 'pointer-events-none opacity-50' : ''}`}>
                    <span className="font-medium text-indigo-600 hover:text-indigo-700">Clique para selecionar</span>
                    <span className="text-gray-600"> ou arraste o arquivo CSV aqui</span>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" disabled={limitReached} />
                  </label>
                  <p className="mt-2 text-sm text-gray-500">Formatos aceitos: CSV (máx. 10MB)</p>
                </div>
              )}

              {/* Preview */}
              {importStatus === 'preview' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 flex-shrink-0 text-yellow-600" size={20} />
                      <div>
                        <h3 className="mb-1 font-medium text-yellow-900">Preview da Importação</h3>
                        <p className="text-sm text-yellow-700">
                          {csvData.length} lead(s) encontrado(s). Revise os dados antes de importar.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Nome</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Telefone</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Empresa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {csvData.slice(0, 5).map((lead, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2">{lead.name}</td>
                              <td className="px-4 py-2">{lead.email}</td>
                              <td className="px-4 py-2">{lead.phone}</td>
                              <td className="px-4 py-2">{lead.company}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvData.length > 5 && (
                      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
                        + {csvData.length - 5} lead(s) adicional(is)
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetCsvImport}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCsvImport}
                      disabled={limitReached}
                      className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {limitReached ? 'Limite Atingido' : `Importar ${csvData.length} Lead(s)`}
                    </button>
                  </div>
                </div>
              )}

              {/* Importing */}
              {importStatus === 'importing' && (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto mb-4 animate-spin text-indigo-600" size={48} />
                  <p className="font-medium text-gray-700">Importando leads...</p>
                </div>
              )}

              {/* Success */}
              {importStatus === 'success' && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto mb-4 text-green-600" size={48} />
                  <h3 className="mb-2 font-medium text-green-900">Importação Concluída!</h3>
                  <p className="text-sm text-green-700">{importResults.success} lead(s) importado(s) com sucesso!</p>
                  {importResults.errors > 0 && (
                    <p className="mt-1 text-sm text-red-600">{importResults.errors} erro(s) encontrado(s)</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}