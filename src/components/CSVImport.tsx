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
    requiredFields.forEach(field => {
      if (!headers.includes(field)) {
        errors.push(`Campo obrigatório "${field}" não encontrado no CSV`);
      }
    });

    // Valida cada linha
    parsedData.forEach((row, index) => {
      requiredFields.forEach(field => {
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
        errors: validationErrors.slice(0, 10), // Mostra apenas os primeiros 10 erros
      });
      setStep('result');
      return;
    }

    setIsProcessing(true);
    
    try {
      const result = await onImport(parsedData);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetImport();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Importar {entityName}</h2>
            <p className="text-sm text-gray-600 mt-1">Faça upload de um arquivo CSV para importar dados</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Download className="text-blue-600 mt-1" size={20} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">Baixe o modelo CSV</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Use nosso modelo para garantir que seu arquivo esteja no formato correto
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-500 transition-colors">
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Arraste seu arquivo CSV aqui
                </h3>
                <p className="text-sm text-gray-500 mb-4">ou clique para selecionar</p>
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
                  className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  Selecionar Arquivo
                </label>
              </div>

              {/* Required Fields */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Campos Obrigatórios:</h3>
                <div className="flex flex-wrap gap-2">
                  {requiredFields.map((field) => (
                    <span
                      key={field}
                      className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm"
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
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

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">Preview dos Dados (primeiras 5 linhas)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                            {requiredFields.includes(header) && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {parsedData.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          {headers.map((header) => (
                            <td key={header} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
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
                <p className="text-sm text-gray-500 text-center">
                  ... e mais {parsedData.length - 5} registro(s)
                </p>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && importResult && (
            <div className="space-y-6">
              {/* Success/Error Summary */}
              <div className={`border rounded-lg p-6 ${
                importResult.success > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {importResult.success > 0 ? (
                    <CheckCircle className="text-green-600 mt-1" size={24} />
                  ) : (
                    <AlertCircle className="text-red-600 mt-1" size={24} />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      {importResult.success > 0 ? 'Importação Concluída!' : 'Falha na Importação'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
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
                <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                    <h3 className="font-semibold text-red-900">Erros Encontrados:</h3>
                  </div>
                  <div className="p-4 max-h-60 overflow-y-auto">
                    <ul className="space-y-2">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                    {importResult.failed > importResult.errors.length && (
                      <p className="text-sm text-gray-500 mt-3">
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
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between">
          <div>
            {step !== 'upload' && step !== 'result' && (
              <button
                onClick={resetImport}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                ← Voltar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {step === 'result' ? 'Fechar' : 'Cancelar'}
            </button>
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={isProcessing}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
