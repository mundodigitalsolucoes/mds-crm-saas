'use client';

import { useState, useRef } from 'react';
import { Upload, Download, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportCSVProps {
  onImport: (data: any[]) => Promise<{ success: number; errors: string[] }>;
  onClose: () => void;
  template: string;
  templateName: string;
}

export default function ImportCSV({ onImport, onClose, template, templateName }: ImportCSVProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    // Ler e fazer preview do CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      setPreview(rows.slice(0, 5)); // Mostra apenas as 5 primeiras linhas
    };
    reader.readAsText(selectedFile);
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      
      const importResult = await onImport(data);
      setResult(importResult);
      setImporting(false);
      
      // Se não houver erros, fecha o modal após 2 segundos
      if (importResult.errors.length === 0) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Upload className="text-green-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Importar CSV</h2>
              <p className="text-sm text-gray-600">Faça upload de um arquivo CSV para importar dados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Download Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="text-blue-600 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Baixe o modelo CSV</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Use nosso modelo para garantir que seu arquivo tenha o formato correto
                </p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  <Download size={16} />
                  Baixar Modelo CSV
                </button>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Selecione o arquivo CSV
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 hover:bg-indigo-50 transition cursor-pointer"
            >
              <Upload className="mx-auto text-gray-400 mb-3" size={40} />
              <p className="text-gray-700 font-medium mb-1">
                {file ? file.name : 'Clique para selecionar um arquivo'}
              </p>
              <p className="text-sm text-gray-500">
                Formato aceito: .csv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">
                Pré-visualização (primeiras 5 linhas)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(preview[0]).map((key) => (
                          <th key={key} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {preview.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {Object.values(row).map((value: any, i) => (
                            <td key={i} className="px-4 py-2 text-gray-700">
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-4 ${result.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-start gap-3">
                {result.errors.length > 0 ? (
                  <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
                ) : (
                  <CheckCircle className="text-green-600 mt-0.5" size={20} />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${result.errors.length > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
                    {result.errors.length > 0 ? 'Importação concluída com avisos' : 'Importação concluída com sucesso!'}
                  </h3>
                  <p className="text-sm mb-2">
                    <span className="font-semibold">{result.success}</span> registro(s) importado(s) com sucesso
                  </p>
                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-yellow-900 mb-2">Erros encontrados:</p>
                      <ul className="space-y-1 text-sm text-yellow-800">
                        {result.errors.map((error, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-yellow-600">•</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload size={18} />
                Importar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
