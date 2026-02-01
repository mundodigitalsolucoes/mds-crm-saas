'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface LeadImport {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  status: string;
  origem: string;
}

interface ValidationError {
  linha: number;
  campo: string;
  erro: string;
}

export default function ImportLeadsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeadImport[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    sucesso: number;
    falhas: number;
    total: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else {
      alert('Por favor, selecione um arquivo CSV válido');
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('O arquivo CSV está vazio ou não contém dados');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const data: LeadImport[] = [];
      const validationErrors: ValidationError[] = [];

      // Valida headers obrigatórios
      const requiredHeaders = ['nome', 'email', 'telefone', 'empresa', 'status', 'origem'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        alert(`Colunas obrigatórias faltando: ${missingHeaders.join(', ')}`);
        return;
      }

      // Processa cada linha
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length !== headers.length) {
          validationErrors.push({
            linha: i + 1,
            campo: 'geral',
            erro: 'Número de colunas não corresponde ao cabeçalho'
          });
          continue;
        }

        const lead: any = {};
        headers.forEach((header, index) => {
          lead[header] = values[index];
        });

        // Validações
        if (!lead.nome || lead.nome.length < 3) {
          validationErrors.push({
            linha: i + 1,
            campo: 'nome',
            erro: 'Nome deve ter pelo menos 3 caracteres'
          });
        }

        if (!lead.email || !lead.email.includes('@')) {
          validationErrors.push({
            linha: i + 1,
            campo: 'email',
            erro: 'Email inválido'
          });
        }

        if (!lead.telefone) {
          validationErrors.push({
            linha: i + 1,
            campo: 'telefone',
            erro: 'Telefone obrigatório'
          });
        }

        const statusValidos = ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'];
        if (!statusValidos.includes(lead.status?.toLowerCase())) {
          validationErrors.push({
            linha: i + 1,
            campo: 'status',
            erro: `Status deve ser: ${statusValidos.join(', ')}`
          });
        }

        data.push(lead as LeadImport);
      }

      setPreview(data);
      setErrors(validationErrors);
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (errors.length > 0) {
      alert('Corrija os erros antes de importar');
      return;
    }

    setImporting(true);

    try {
      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: preview }),
      });

      const result = await response.json();

      setImportResult({
        sucesso: result.sucesso || preview.length,
        falhas: result.falhas || 0,
        total: preview.length,
      });

      // Limpa após importação bem-sucedida
      if (result.sucesso === preview.length) {
        setTimeout(() => {
          window.location.href = '/dashboard/leads';
        }, 3000);
      }
    } catch (error) {
      alert('Erro ao importar leads. Tente novamente.');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'nome,email,telefone,empresa,status,origem\nJoão Silva,joao@email.com,(19) 99999-9999,Empresa A,novo,site\nMaria Santos,maria@email.com,(19) 98888-8888,Empresa B,contato,indicação';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-leads.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/leads" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4">
            <ArrowLeft size={20} />
            <span>Voltar para Leads</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Importar Leads (CSV)</h1>
          <p className="text-gray-600 mt-2">Faça upload de um arquivo CSV para importar leads em massa</p>
        </div>

        {/* Download Template */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Primeiro vez importando?</h3>
              <p className="text-sm text-blue-800 mb-3">Baixe nosso template CSV para garantir que seu arquivo está no formato correto.</p>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Download size={16} />
                Baixar Template CSV
              </button>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        {!importResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors">
              <Upload className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {file ? file.name : 'Selecione um arquivo CSV'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                ou arraste e solte aqui
              </p>
              <label className="inline-block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer inline-block font-medium">
                  Escolher Arquivo
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <XCircle className="text-red-600 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">
                  {errors.length} erro(s) encontrado(s)
                </h3>
                <p className="text-sm text-red-800">Corrija os erros abaixo antes de importar</p>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {errors.map((error, index) => (
                <div key={index} className="bg-white rounded p-3 text-sm">
                  <span className="font-semibold text-red-900">Linha {error.linha}</span>
                  <span className="text-gray-600"> - Campo: </span>
                  <span className="font-medium text-gray-900">{error.campo}</span>
                  <span className="text-gray-600"> - </span>
                  <span className="text-red-800">{error.erro}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && !importResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText size={24} />
                  Preview dos Dados
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {preview.length} lead(s) encontrado(s) - {errors.length} erro(s)
                </p>
              </div>
              {errors.length === 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Importar Leads
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Telefone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.slice(0, 10).map((lead, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{lead.nome}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lead.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lead.telefone}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lead.empresa}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lead.origem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && (
                <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
                  Mostrando 10 de {preview.length} registros
                </div>
              )}
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
              importResult.falhas === 0 ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {importResult.falhas === 0 ? (
                <CheckCircle className="text-green-600" size={32} />
              ) : (
                <AlertCircle className="text-yellow-600" size={32} />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Importação Concluída!</h2>
            <div className="space-y-2 mb-6">
              <p className="text-lg text-gray-700">
                <span className="font-semibold text-green-600">{importResult.sucesso}</span> leads importados com sucesso
              </p>
              {importResult.falhas > 0 && (
                <p className="text-lg text-gray-700">
                  <span className="font-semibold text-red-600">{importResult.falhas}</span> leads falharam
                </p>
              )}
              <p className="text-sm text-gray-600">Total processado: {importResult.total}</p>
            </div>
            {importResult.falhas === 0 && (
              <p className="text-sm text-gray-600">Redirecionando para a lista de leads...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
