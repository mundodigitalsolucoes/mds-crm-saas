'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PermissionGate } from '@/components/PermissionGate';
import axios from 'axios';

interface SSOData {
  accessToken:       string
  client:            string
  uid:               string
  tokenType:         string
  chatwootUrl:       string
  chatwootAccountId: number
}

function NotConfigured() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 p-8">
      <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-gray-500" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white mb-1">
          Atendimento não configurado
        </h2>
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

function ChatwootIframe({ ssoUrl, dashboardUrl }: { ssoUrl: string; dashboardUrl: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState(ssoUrl);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'chatwoot_sso_done') {
        // SSO concluído — troca src do iframe para o dashboard
        setSrc(dashboardUrl);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dashboardUrl]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <h1 className="text-xl font-semibold text-gray-800">Atendimento</h1>
      </div>
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          src={src}
          className="absolute inset-0 w-full h-full border-0"
          allow="microphone; camera; clipboard-write"
          title="Atendimento"
        />
      </div>
    </div>
  );
}

export default function AtendimentoPage() {
  const [urls, setUrls]   = useState<{ sso: string; dashboard: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    axios
      .get<SSOData>('/api/integrations/chatwoot/sso')
      .then(({ data }) => {
        const base   = data.chatwootUrl.replace(/\/$/, '');
        const params = new URLSearchParams({
          access_token: data.accessToken,
          client:       data.client,
          uid:          data.uid,
          account_id:   String(data.chatwootAccountId),
        });
        setUrls({
          sso:       `${base}/mds-sso?${params.toString()}`,
          dashboard: `${base}/app/accounts/${data.chatwootAccountId}/dashboard`,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PermissionGate module="atendimento" action="view">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : error || !urls ? (
        <NotConfigured />
      ) : (
        <ChatwootIframe ssoUrl={urls.sso} dashboardUrl={urls.dashboard} />
      )}
    </PermissionGate>
  );
}
