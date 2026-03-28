// src/app/(app)/atendimento/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Settings, Loader2, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { PermissionGate } from '@/components/PermissionGate';
import axios from 'axios';

interface ChatwootCredentials {
  organizationId: string;
  cacheKey: string;
  email: string;
  password: string;
  chatwootUrl: string;
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

  const copy = async () => {
    await navigator.clipboard.writeText(text);
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
  const { chatwootUrl, chatwootAccountId, email, password, organizationId, cacheKey } = creds;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showHint, setShowHint] = useState(true);

  const SIDEBAR_WIDTH = 264;
  const BANNER_HEIGHT = 40;

  const iframeUrl =
    `${chatwootUrl}/app/accounts/${chatwootAccountId}/dashboard` +
    `?crm_org=${encodeURIComponent(organizationId)}` +
    `&crm_ctx=${encodeURIComponent(cacheKey)}`;

  useEffect(() => {
    setShowHint(true);
  }, [cacheKey]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const href = iframe.contentWindow?.location?.href ?? '';
        if (href && !href.includes('/login')) {
          setShowHint(false);
        }
      } catch {
        // Cross-origin. Mantém o banner.
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [cacheKey]);

  const topOffset = showHint ? BANNER_HEIGHT : 0;

  return (
    <div className="w-full h-full relative">
      {showHint && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: SIDEBAR_WIDTH,
            right: 0,
            height: BANNER_HEIGHT,
            zIndex: 50,
          }}
          className="flex items-center gap-3 px-6 border-b border-amber-200 bg-amber-50"
        >
          <MessageSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-800">
            Faça login com: <strong>{email}</strong>
          </span>
          <CopyButton text={password} />
        </div>
      )}

      <iframe
        key={cacheKey}
        ref={iframeRef}
        src={iframeUrl}
        style={{
          position: 'fixed',
          top: topOffset,
          left: SIDEBAR_WIDTH,
          right: 0,
          bottom: 0,
          width: `calc(100vw - ${SIDEBAR_WIDTH}px)`,
          height: `calc(100vh - ${topOffset}px)`,
          border: 'none',
          zIndex: 40,
          background: '#111827',
        }}
        allow="microphone; camera; clipboard-write"
        title={`Atendimento-${organizationId}-${chatwootAccountId}`}
      />
    </div>
  );
}

export default function AtendimentoPage() {
  const [creds, setCreds] = useState<ChatwootCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadCredentials() {
      setLoading(true);
      setError(false);
      setCreds(null);

      try {
        const { data } = await axios.get<ChatwootCredentials>(
          '/api/integrations/chatwoot/credentials',
          {
            signal: controller.signal,
            params: {
              t: Date.now(),
            },
            headers: {
              'Cache-Control': 'no-store',
              Pragma: 'no-cache',
            },
          }
        );

        if (!mounted) return;
        setCreds(data);
      } catch (err) {
        if (!mounted || controller.signal.aborted) return;
        setError(true);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    loadCredentials();

    return () => {
      mounted = false;
      controller.abort();
    };
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
        <ChatwootIframe key={creds.cacheKey} creds={creds} />
      )}
    </PermissionGate>
  );
}