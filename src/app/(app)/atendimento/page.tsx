// src/app/(app)/atendimento/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Settings, Loader2 } from 'lucide-react';
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

function ChatwootIframe({ creds }: { creds: ChatwootCredentials }) {
  const { chatwootUrl, chatwootAccountId } = creds;
  const iframeUrl = `${chatwootUrl}/app/accounts/${chatwootAccountId}/dashboard`;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 relative">
        <iframe
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