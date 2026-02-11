'use client';

import { useEffect, useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useLeadsStore, type Lead, type Stage } from '@/store/leadsStore';

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
};

export default function NewLeadModal({
  isOpen,
  onClose,
  mode = 'create',
  initialData = null,
}: NewLeadModalProps) {
  const { addLead, updateLead, stages } = useLeadsStore();

  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'importing' | 'success' | 'error'>('idle');
  const [importResults, setImportResults] = useState({ success: 0, errors: 0, total: 0 });

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
      });
    } else {
      setActiveTab('manual');
      setFormData(emptyForm);
    }

    setFormError(null);
    setIsSaving(false);
    setCsvFile(null);
    setCsvData([]);
    setImportStatus('idle');
    setImportResults({ success: 0, errors: 0, total: 0 });
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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

        // Aceita tanto PT-BR quanto EN nos headers do CSV
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
    setImportStatus('importing');
    let successCount = 0;
    let errorCount = 0;

    for (const lead of csvData) {
      const result = await addLead(lead);
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
    setImportStatus('idle');
    setImportResults({ success: 0, errors: 0, total: 0 });
  };

  const downloadTemplate = () => {
    const template =
      'name,email,phone,company,status,source,value\nJoão Silva,joao@email.com,(19) 99999-9999,Empresa A,new,site,2500\nMaria Santos,maria@email.com,(19) 98888-8888,Empresa B,contacted,indicacao,5000';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-leads.csv';
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">
            {mode === 'edit' ? 'Editar Lead' : 'Adicionar Leads'}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="inline mr-2" size={18} />
            Manual
          </button>
          <button
            disabled={mode === 'edit'}
            onClick={() => (mode === 'edit' ? null : setActiveTab('csv'))}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              mode === 'edit'
                ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                : activeTab === 'csv'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Upload className="inline mr-2" size={18} />
            Importar CSV
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={18} />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="João Silva"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="joao@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="(19) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Empresa Exemplo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Diretor Comercial"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="5000.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Notas sobre o lead..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={18} className="animate-spin" />}
                  {mode === 'edit' ? 'Salvar Alterações' : 'Adicionar Lead'}
                </button>
              </div>
            </form>
          ) : (
            /* ==================== ABA CSV ==================== */
            <div className="space-y-6">
              {/* Download Template */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Download className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900 mb-1">Baixar Template CSV</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Use nosso template para garantir que seu CSV está no formato correto.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Baixar Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              {importStatus === 'idle' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                  <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                  <label className="cursor-pointer">
                    <span className="text-indigo-600 hover:text-indigo-700 font-medium">Clique para selecionar</span>
                    <span className="text-gray-600"> ou arraste o arquivo CSV aqui</span>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  </label>
                  <p className="text-sm text-gray-500 mt-2">Formatos aceitos: CSV (máx. 10MB)</p>
                </div>
              )}

              {/* Preview */}
              {importStatus === 'preview' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                      <div>
                        <h3 className="font-medium text-yellow-900 mb-1">Preview da Importação</h3>
                        <p className="text-sm text-yellow-700">
                          {csvData.length} lead(s) encontrado(s). Revise os dados antes de importar.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
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
                      <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 border-t border-gray-200">
                        + {csvData.length - 5} lead(s) adicional(is)
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetCsvImport}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCsvImport}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Importar {csvData.length} Lead(s)
                    </button>
                  </div>
                </div>
              )}

              {/* Importing */}
              {importStatus === 'importing' && (
                <div className="text-center py-8">
                  <Loader2 className="mx-auto text-indigo-600 mb-4 animate-spin" size={48} />
                  <p className="text-gray-700 font-medium">Importando leads...</p>
                </div>
              )}

              {/* Success */}
              {importStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle2 className="mx-auto text-green-600 mb-4" size={48} />
                  <h3 className="font-medium text-green-900 mb-2">Importação Concluída!</h3>
                  <p className="text-sm text-green-700">{importResults.success} lead(s) importado(s) com sucesso!</p>
                  {importResults.errors > 0 && (
                    <p className="text-sm text-red-600 mt-1">{importResults.errors} erro(s) encontrado(s)</p>
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
