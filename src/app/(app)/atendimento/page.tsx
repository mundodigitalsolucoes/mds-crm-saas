// src/app/(app)/atendimento/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Settings, Loader2, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { PermissionGate } from '@/components/PermissionGate';
import axios from 'axios';

interface ChatwootCredentials {
  email:             string;
  password:          string;
  chatwootUrl:       string;
  chatwootAccountId: number;
}

function NotConfigured() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 p-8">
      <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-gray-500" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white mb-1">Atendimento não configurado</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          Configure a integração com o Chatwoot para começar a atender seus clientes diretamente pelo CRM.
        </p>
      </div>
      <Link
        href="/settings/integrations"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Settings className="w-4 h-4" />
        Configurar Integração
      </Link>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : 'Copiar senha'}
    </button>
  );
}

function ChatwootIframe({ creds }: { creds: ChatwootCredentials }) {
  const { chatwootUrl, chatwootAccountId, email, password } = creds;
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [showHint, setShowHint] = useState(true);

  const iframeUrl = `${chatwootUrl}/app/accounts/${chatwootAccountId}/dashboard`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      // Tenta ler a URL do iframe — se chegou no dashboard, some o banner
      try {
        const iframeSrc = iframe.contentWindow?.location?.href || '';
        if (iframeSrc.includes('/dashboard') || iframeSrc.includes('/accounts/')) {
          setShowHint(false);
        }
      } catch {
        // Cross-origin: não consegue ler a URL, mas se o iframe carregou
        // após o login o banner some mesmo assim num segundo load
        setShowHint(false);
      }
    };

    // Primeiro load = página de login, não some ainda
    let loadCount = 0;
    const handleLoadCount = () => {
      loadCount++;
      if (loadCount >= 2) {
        // Segundo load em diante = após submit do login = logado
        setShowHint(false);
      }
    };

    iframe.addEventListener('load', handleLoadCount);
    return () => iframe.removeEventListener('load', handleLoadCount);
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      {showHint && (
        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-amber-200 bg-amber-50 flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-800">
            Faça login com: <strong>{email}</strong>
          </span>
          <CopyButton text={password} />
        </div>
      )}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="microphone; camera; clipboard-write"
          title="Atendimento"
        />
      </div>
    </div>
  );
}

export default function AtendimentoPage() {
  const [creds, setCreds]     = useState<ChatwootCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    axios
      .get<ChatwootCredentials>('/api/integrations/chatwoot/credentials')
      .then(({ data }) => setCreds(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PermissionGate module="atendimento" action="view">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : error || !creds ? (
        <NotConfigured />
      ) : (
        <ChatwootIframe creds={creds} />
      )}
    </PermissionGate>
  );
}
