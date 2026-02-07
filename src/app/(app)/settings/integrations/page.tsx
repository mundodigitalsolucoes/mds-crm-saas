'use client';

import { useState, useEffect } from 'react';
import { Plug, MessageCircle, CheckCircle, XCircle, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react';

interface WhatsAppConfig {
  instanceName: string;
  apiKey: string;
  serverUrl: string;
  isConnected: boolean;
}

export default function IntegrationsPage() {
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    instanceName: '',
    apiKey: '',
    serverUrl: '',
    isConnected: false,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/integrations/whatsapp');
      if (response.ok) {
        const data = await response.json();
        setWhatsappConfig(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(whatsappConfig),
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      } else {
        throw new Error('Erro ao salvar');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/integrations/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(whatsappConfig),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setWhatsappConfig(prev => ({ ...prev, isConnected: true }));
        setMessage({ type: 'success', text: 'Conexão estabelecida com sucesso!' });
      } else {
        setWhatsappConfig(prev => ({ ...prev, isConnected: false }));
        setMessage({ type: 'error', text: data.error || 'Falha na conexão.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao testar conexão.' });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copiado para a área de transferência!' });
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Plug className="text-indigo-600" />
          Integrações
        </h1>
        <p className="text-gray-600 mt-1">Gerencie as integrações do seu CRM</p>
      </div>

      {/* WhatsApp Evolution API */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <MessageCircle className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">WhatsApp - Evolution API</h2>
                <p className="text-sm text-gray-600">Envie mensagens automáticas para seus leads</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              whatsappConfig.isConnected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {whatsappConfig.isConnected ? (
                <>
                  <CheckCircle size={16} />
                  Conectado
                </>
              ) : (
                <>
                  <XCircle size={16} />
                  Desconectado
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {message && (
            <div className={`p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
              {message.text}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL do Servidor
            </label>
            <input
              type="url"
              value={whatsappConfig.serverUrl}
              onChange={(e) => setWhatsappConfig(prev => ({ ...prev, serverUrl: e.target.value }))}
              placeholder="https://sua-evolution-api.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Instância
            </label>
            <input
              type="text"
              value={whatsappConfig.instanceName}
              onChange={(e) => setWhatsappConfig(prev => ({ ...prev, instanceName: e.target.value }))}
              placeholder="minha-instancia"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key (Token)
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={whatsappConfig.apiKey}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Sua chave de API"
                className="w-full px-4 py-2.5 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(whatsappConfig.apiKey)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            <button
              onClick={testConnection}
              disabled={testing || !whatsappConfig.serverUrl || !whatsappConfig.instanceName || !whatsappConfig.apiKey}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {testing ? 'Testando...' : 'Testar Conexão'}
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <ExternalLink size={16} />
              Documentação
            </h3>
            <p className="text-sm text-gray-600">
              Para configurar a Evolution API, acesse a{' '}
              <a 
                href="https://doc.evolution-api.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                documentação oficial
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
