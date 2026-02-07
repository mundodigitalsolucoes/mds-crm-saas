'use client';

import { useState, useEffect } from 'react';
import { Plug, MessageCircle, CheckCircle, XCircle, ExternalLink, Copy, Eye, EyeOff, Save, TestTube } from 'lucide-react';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar configurações salvas
  useEffect(() => {
    const saved = localStorage.getItem('whatsapp_config');
    if (saved) {
      setWhatsappConfig(JSON.parse(saved));
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    
    try {
      // Salvar no localStorage (em produção, salvar no backend)
      localStorage.setItem('whatsapp_config', JSON.stringify(whatsappConfig));
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);

    try {
      const response = await fetch(`${whatsappConfig.serverUrl}/instance/connectionState/${whatsappConfig.instanceName}`, {
        headers: {
          'apikey': whatsappConfig.apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const isConnected = data?.instance?.state === 'open';
        setWhatsappConfig(prev => ({ ...prev, isConnected }));
        localStorage.setItem('whatsapp_config', JSON.stringify({ ...whatsappConfig, isConnected }));
        setMessage({ 
          type: isConnected ? 'success' : 'error', 
          text: isConnected ? 'WhatsApp conectado!' : 'WhatsApp desconectado. Verifique a instância.' 
        });
      } else {
        throw new Error('Falha na conexão');
      }
    } catch (error) {
      setWhatsappConfig(prev => ({ ...prev, isConnected: false }));
      setMessage({ type: 'error', text: 'Erro ao testar conexão. Verifique as credenciais.' });
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copiado para a área de transferência!' });
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Plug className="w-7 h-7 text-blue-600" />
          Integrações
        </h1>
        <p className="text-gray-600 mt-1">Gerencie as integrações do seu CRM com serviços externos</p>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Card WhatsApp - Evolution API */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">WhatsApp - Evolution API</h2>
                <p className="text-sm text-gray-500">Envie mensagens automáticas para seus leads</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              whatsappConfig.isConnected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {whatsappConfig.isConnected ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Conectado
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Desconectado
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Server URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL do Servidor
            </label>
            <div className="relative">
              <input
                type="url"
                value={whatsappConfig.serverUrl}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, serverUrl: e.target.value }))}
                placeholder="https://sua-evolution-api.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <button
                onClick={() => copyToClipboard(whatsappConfig.serverUrl)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                title="Copiar"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Instance Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Instância
            </label>
            <div className="relative">
              <input
                type="text"
                value={whatsappConfig.instanceName}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, instanceName: e.target.value }))}
                placeholder="minha-instancia"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <button
                onClick={() => copyToClipboard(whatsappConfig.instanceName)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                title="Copiar"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={whatsappConfig.apiKey}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Sua chave de API"
                className="w-full px-4 py-2.5 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                  title={showApiKey ? 'Ocultar' : 'Mostrar'}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => copyToClipboard(whatsappConfig.apiKey)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                  title="Copiar"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Documentação */}
          <div className="pt-2">
            <a
              href="https://doc.evolution-api.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Documentação da Evolution API
            </a>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !whatsappConfig.serverUrl || !whatsappConfig.instanceName || !whatsappConfig.apiKey}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <TestTube className="w-4 h-4" />
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>

      {/* Outras integrações futuras */}
      <div className="mt-6 p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-center text-gray-500">
          🚀 Mais integrações em breve: Email Marketing, Gateway de Pagamento, CRM externo...
        </p>
      </div>
    </div>
  );
}
