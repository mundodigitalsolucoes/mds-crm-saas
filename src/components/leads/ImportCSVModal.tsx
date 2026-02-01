'use client';

import { useState } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (leads: any[]) => void;
}

export default function ImportCSVModal({ isOpen, onClose, onImport }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setErrors(['Arquivo CSV vazio ou inválido']);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredFields = ['nome', 'email', 'telefone'];
      const missingFields = requiredFields.filter(field => !headers.includes(field));

      if (missingFields.length > 0) {
        setErrors([`Campos obrigatórios faltando: ${missingFields.join(', ')}`]);
        return;
      }

      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const lead: any = { id: Date.now() + index };
        
        headers.forEach((header, i) => {
          lead[header] = values[i] || '';
        });

        // Campos padrão se não existirem
        if (!lead.status) lead.status = 'novo';
        if (!lead.origem) lead.origem = 'importacao';
        if (!lead.dataCriacao) lead.dataCriacao = new Date().toISOString();
        if (!lead.ultimoContato) lead.ultimoContato = new Date().toISOString();

        return lead;
      });

      setPreview(data);
      setErrors([]);
      setStep('preview');
    };

    reader.readAsText(file);
  };

  const handleImport = () => {
    const validLeads = preview.filter(lead => lead.nome && lead.email && lead.telefone);
    const invalidCount = preview.length - validLeads.length;

    setImportResult({
      success: validLeads.length,
      failed: invalidCount,
    });

    onImport(validLeads);
    setStep('result');
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setStep('upload');
    setImportResult({ success: 0, failed: 0 });
    onClose();
  };

  const downloadTemplate = () => {
    const template = 'nome,email,telefone,empresa,cargo,status,origem,observacoes\nJoão Silva,joao@email.com,(19) 99999-9999,Empresa A,Gerente,novo,site,Contato via formulário';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-leads.csv';
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-800">Importar Leads via CSV</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Template Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="text-blue-600 mt-1" size={20} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">
                      Primeira vez importando?
                    </h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Baixe nosso template com os campos corretos e exemplos.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      📥 Baixar Template CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-indigo-500 transition-colors">
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {file ? file.name : 'Selecione o arquivo CSV'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  ou arraste e solte aqui
                </p>
                <label className="inline-block">
                  <span className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors">
                    Escolher Arquivo
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  {errors.map((error, i) => (
                    <div key={i} className="flex items-start gap-2 text-red-700">
                      <AlertCircle size={20} className="mt-0.5" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Required Fields */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">Campos Obrigatórios:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✓ <strong>nome</strong> - Nome completo do lead</li>
                  <li>✓ <strong>email</strong> - Email de contato</li>
                  <li>✓ <strong>telefone</strong> - Número de telefone</li>
                </ul>
                <h4 className="font-semibold text-gray-700 mt-4 mb-2">Campos Opcionais:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• empresa, cargo, status, origem, observacoes</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={20} />
                  <span className="font-semibold">
                    {preview.length} leads encontrados no arquivo
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Telefone</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Empresa</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((lead, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">{lead.nome}</td>
                        <td className="px-4 py-3">{lead.email}</td>
                        <td className="px-4 py-3">{lead.telefone}</td>
                        <td className="px-4 py-3">{lead.empresa || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 5 && (
                  <div className="bg-gray-50 px-4 py-3 text-sm text-gray-600 text-center border-t">
                    ... e mais {preview.length - 5} leads
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                >
                  Importar {preview.length} Leads
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && (
            <div className="space-y-6 text-center py-8">
              <CheckCircle className="mx-auto text-green-500" size={64} />
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  Importação Concluída!
                </h3>
                <p className="text-gray-600">
                  {importResult.success} leads foram importados com sucesso
                  {importResult.failed > 0 && ` (${importResult.failed} falharam)`}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
