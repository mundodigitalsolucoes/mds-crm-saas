'use client';

import { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Download } from 'lucide-react';

interface LeadCSV {
  nome: string;
  whatsapp: string;
  email?: string;
  empresa?: string;
  status?: string;
  origem?: string;
}

interface ImportResult {
  success: number;
  errors: { linha: number; erro: string; dados: any }[];
}

export default function ImportLeadsCSV({ onImportComplete }: { onImportComplete?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeadCSV[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Função para validar WhatsApp
  const validateWhatsApp = (whatsapp: string): string => {
    // Remove tudo que não é número
    const cleaned = whatsapp.replace(/\D/g, '');
    
    // Valida se tem pelo menos 10 dígitos (DDD + número)
    if (cleaned.length < 10) {
      throw new Error('WhatsApp inválido');
    }
    
    // Adiciona +55 se não tiver código do país
    return cleaned.startsWith('55') ? `+${cleaned}` : `+55${cleaned}`;
  };

  // Função para processar o CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const data: LeadCSV[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const lead: any = {};

        headers.forEach((header, index) => {
          lead[header] = values[index] || '';
        });

        data.push(lead);
      }

      setPreview(data.slice(0, 5)); // Mostra apenas 5 linhas de preview
      setShowModal(true);
    };

    reader.readAsText(selectedFile);
  };

  // Função para importar os leads
  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const results: ImportResult = {
        success: 0,
        errors: []
      };

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const lead: any = {};

        headers.forEach((header, index) => {
          lead[header] = values[index] || '';
        });

        try {
          // Validações
          if (!lead.nome || lead.nome.length < 2) {
            throw new Error('Nome é obrigatório e deve ter pelo menos 2 caracteres');
          }

          if (!lead.whatsapp) {
            throw new Error('WhatsApp é obrigatório');
          }

          // Formata WhatsApp
          const whatsappFormatado = validateWhatsApp(lead.whatsapp);

          // Prepara dados para enviar
          const leadData = {
            nome: lead.nome,
            whatsapp: whatsappFormatado,
            email: lead.email || null,
            empresa: lead.empresa || null,
            status: lead.status || 'novo',
            origem: lead.origem || 'importacao_csv'
          };

          // Envia para API
          const response = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao importar lead');
          }

          results.success++;
        } catch (error: any) {
          results.errors.push({
            linha: i + 1,
            erro: error.message,
            dados: lead
          });
        }
      }

      setResult(results);
      setImporting(false);
      
      if (onImportComplete) {
        onImportComplete();
      }
    };

    reader.readAsText(file);
  };

  // Função para baixar CSV modelo
  const downloadTemplate = () => {
    const template = `nome,whatsapp,email,empresa,status,origem
João Silva,19999999999,joao@email.com,Empresa A,novo,site
Maria Santos,(19) 98888-8888,maria@email.com,Empresa B,contato,indicacao
Pedro Oliveira,+5519977777777,pedro@email.com,Empresa C,qualificado,google`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo-importacao-leads.csv';
    link.click();
  };

  return (
    <>
      {/* Botão para abrir modal */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <Upload size={20} />
        Importar CSV
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Importar Leads via CSV</h2>
                <p className="text-green-100 text-sm mt-1">
                  Campos obrigatórios: <strong>Nome</strong> e <strong>WhatsApp</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFile(null);
                  setPreview([]);
                  setResult(null);
                }}
                className="text-white hover:bg-green-800 p-2 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {!result ? (
                <>
                  {/* Download Template */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <Download className="text-blue-600 mt-1" size={20} />
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-1">
                          Não tem um CSV pronto?
                        </h3>
                        <p className="text-sm text-blue-700 mb-3">
                          Baixe nosso modelo e preencha com seus dados
                        </p>
                        <button
                          onClick={downloadTemplate}
                          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Baixar Modelo CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6 hover:border-green-500 transition-colors">
                    <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-semibold mb-2">
                      Selecione seu arquivo CSV
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      O arquivo deve conter as colunas: nome, whatsapp (obrigatórios) e
                      email, empresa, status, origem (opcionais)
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="cursor-pointer inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Escolher Arquivo
                    </label>
                    {file && (
                      <p className="mt-4 text-sm text-green-600 font-medium">
                        ✓ Arquivo selecionado: {file.name}
                      </p>
                    )}
                  </div>

                  {/* Preview */}
                  {preview.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle className="text-green-600" size={20} />
                        Preview dos Dados (primeiras 5 linhas)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-4 py-2 text-left">Nome</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">WhatsApp</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">Empresa</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((lead, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-2">{lead.nome}</td>
                                <td className="border border-gray-300 px-4 py-2">{lead.whatsapp}</td>
                                <td className="border border-gray-300 px-4 py-2">{lead.email || '-'}</td>
                                <td className="border border-gray-300 px-4 py-2">{lead.empresa || '-'}</td>
                                <td className="border border-gray-300 px-4 py-2">{lead.status || 'novo'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Resultado da Importação */
                <div>
                  <div className="text-center mb-6">
                    <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      Importação Concluída!
                    </h3>
                    <div className="flex justify-center gap-8 mt-4">
                      <div className="bg-green-100 rounded-lg p-4">
                        <p className="text-3xl font-bold text-green-600">{result.success}</p>
                        <p className="text-sm text-green-800">Leads Importados</p>
                      </div>
                      {result.errors.length > 0 && (
                        <div className="bg-red-100 rounded-lg p-4">
                          <p className="text-3xl font-bold text-red-600">{result.errors.length}</p>
                          <p className="text-sm text-red-800">Erros</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Erros */}
                  {result.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                        <AlertCircle size={20} />
                        Erros na Importação:
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {result.errors.map((error, index) => (
                          <div key={index} className="text-sm bg-white rounded p-3">
                            <p className="font-medium text-red-800">
                              Linha {error.linha}: {error.erro}
                            </p>
                            <p className="text-gray-600 text-xs mt-1">
                              Dados: {JSON.stringify(error.dados)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              {!result ? (
                <>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setFile(null);
                      setPreview([]);
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!file || importing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload size={20} />
                        Importar Leads
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowModal(false);
                    setFile(null);
                    setPreview([]);
                    setResult(null);
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
