'use client';

import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import Papa from 'papaparse';

interface CSVImportProps {
  onImport: (data: any[]) => Promise<{ success: number; failed: number; errors: string[] }>;
  templateFields: string[];
  requiredFields: string[];
  entityName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CSVImport({
  onImport,
  templateFields,
  requiredFields,
  entityName,
  isOpen,
  onClose,
}: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sendToKanban, setSendToKanban] = useState(true);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else {
      alert('Por favor, selecione um arquivo CSV válido');
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setHeaders(results.meta.fields || []);
        setParsedData(results.data);
        setStep('preview');
      },
      error: (error) => {
        alert('Erro ao processar arquivo: ' + error.message);
      },
    });
  };

  const validateData = () => {
    const errors: string[] = [];

    // Verifica se todos os campos obrigatórios estão presentes
    requiredFields.forEach((field) => {
      if (!headers.includes(field)) {
        errors.push(`Campo obrigatório "${field}" não encontrado no CSV`);
      }
    });

    // Valida cada linha
    parsedData.forEach((row, index) => {
      requiredFields.forEach((field) => {
        if (!row[field] || row[field].toString().trim() === '') {
          errors.push(`Linha ${index + 2}: Campo "${field}" está vazio`);
        }
      });
    });

    return errors;
  };

  const handleImport = async () => {
    const validationErrors = validateData();

    if (validationErrors.length > 0) {
      setImportResult({
        success: 0,
        failed: parsedData.length,
        errors: validationErrors.slice(0, 10),
      });
      setStep('result');
      return;
    }

    setIsProcessing(true);

    try {
      const preparedData = parsedData.map((row) => ({
        ...row,
        inKanban: sendToKanban,
      }));

      const result = await onImport(preparedData);
      setImportResult(result);
      setStep('result');
    } catch (error) {
      setImportResult({
        success: 0,
        failed: parsedData.length,
        errors: ['Erro ao importar dados: ' + (error as Error).message],
      });
      setStep('result');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = templateFields.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_${entityName.toLowerCase()}.csv`;
    link.click();
  };

  const resetImport = () => {
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setImportResult(null);
    setStep('upload');
    setSendToKanban(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetImport();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Importar {entityName}</h2>
            <p className="mt-1 text-sm text-gray-600">Faça upload de um arquivo CSV para importar dados</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Download Template */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Download className="mt-1 text-blue-600" size={20} />
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-blue-900">Baixe o modelo CSV</h3>
                    <p className="mb-3 text-sm text-blue-700">
                      Use nosso modelo para garantir que seu arquivo esteja no formato correto
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                    >
                      Baixar Modelo CSV
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={sendToKanban}
                    onChange={(e) => setSendToKanban(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="font-medium text-indigo-900">Enviar para o pipeline agora</p>
                    <p className="text-sm text-indigo-700">
                      Desmarcado, os leads serão importados na base e ficarão fora do Kanban.
                    </p>
                  </div>
                </label>
              </div>

              {/* Upload Area */}
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center transition-colors hover:border-indigo-500">
                <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                <h3 className="mb-2 text-lg font-semibold text-gray-700">
                  Arraste seu arquivo CSV aqui
                </h3>
                <p className="mb-4 text-sm text-gray-500">ou clique para selecionar</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-block cursor-pointer rounded-lg bg-indigo-600 px-6 py-2 text-white transition-colors hover:bg-indigo-700"
                >
                  Selecionar Arquivo
                </label>
              </div>

              {/* Required Fields */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 font-semibold text-gray-800">Campos Obrigatórios:</h3>
                <div className="flex flex-wrap gap-2">
                  {requiredFields.map((field) => (
                    <span
                      key={field}
                      className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-800"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <div>
                    <h3 className="font-semibold text-green-900">Arquivo carregado com sucesso!</h3>
                    <p className="text-sm text-green-700">
                      {parsedData.length} registro(s) encontrado(s) • {headers.length} coluna(s)
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={sendToKanban}
                    onChange={(e) => setSendToKanban(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="font-medium text-indigo-900">Enviar para o pipeline agora</p>
                    <p className="text-sm text-indigo-700">
                      Desmarcado, os leads serão importados na base e ficarão fora do Kanban.
                    </p>
                  </div>
                </label>
              </div>

              {/* Preview Table */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
                  <h3 className="font-semibold text-gray-800">Preview dos Dados (primeiras 5 linhas)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          >
                            {header}
                            {requiredFields.includes(header) && (
                              <span className="ml-1 text-red-500">*</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {parsedData.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          {headers.map((header) => (
                            <td key={header} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                              {row[header] || <span className="text-gray-400">-</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedData.length > 5 && (
                <p className="text-center text-sm text-gray-500">
                  ... e mais {parsedData.length - 5} registro(s)
                </p>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && importResult && (
            <div className="space-y-6">
              {/* Success/Error Summary */}
              <div
                className={`rounded-lg border p-6 ${
                  importResult.success > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {importResult.success > 0 ? (
                    <CheckCircle className="mt-1 text-green-600" size={24} />
                  ) : (
                    <AlertCircle className="mt-1 text-red-600" size={24} />
                  )}
                  <div className="flex-1">
                    <h3 className="mb-2 text-lg font-semibold">
                      {importResult.success > 0 ? 'Importação Concluída!' : 'Falha na Importação'}
                    </h3>
                    <div className="mb-3 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Importados com sucesso:</p>
                        <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Falharam:</p>
                        <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-red-200 bg-white">
                  <div className="border-b border-red-200 bg-red-50 px-4 py-2">
                    <h3 className="font-semibold text-red-900">Erros Encontrados:</h3>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-4">
                    <ul className="space-y-2">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-red-700">
                          <span className="mt-0.5 text-red-500">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                    {importResult.failed > importResult.errors.length && (
                      <p className="mt-3 text-sm text-gray-500">
                        ... e mais {importResult.failed - importResult.errors.length} erro(s)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-gray-200 bg-gray-50 p-6">
          <div>
            {step !== 'upload' && step !== 'result' && (
              <button
                onClick={resetImport}
                className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900"
              >
                ← Voltar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              {step === 'result' ? 'Fechar' : 'Cancelar'}
            </button>
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isProcessing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Importar Dados
                  </>
                )}
              </button>
            )}
            {step === 'result' && importResult && importResult.failed > 0 && (
              <button
                onClick={resetImport}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-white transition-colors hover:bg-indigo-700"
              >
                Tentar Novamente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}