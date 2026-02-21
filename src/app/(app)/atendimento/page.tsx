// src/app/(app)/atendimento/page.tsx
// Página de Atendimento — Chatwoot embeddado em fullscreen via iframe
// ✅ URL dinâmica por organização (via ConnectedAccount)
// ✅ Permissão controlada por PermissionGate (módulo atendimento)

'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PermissionGate } from '@/components/PermissionGate';
import axios from 'axios';

interface ChatwootStatus {
  connected:         boolean;
  chatwootUrl:       string;
  chatwootAccountId: number;
}

// ─── Fallback: Chatwoot não configurado ───────────────────────────────────────

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

// ─── Iframe Chatwoot ──────────────────────────────────────────────────────────

function ChatwootIframe({ url }: { url: string }) {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <h1 className="text-xl font-semibold text-gray-800">Atendimento</h1>
      </div>
      {/* Iframe fullscreen */}
      <div className="flex-1 relative">
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full border-0"
          allow="microphone; camera; clipboard-write"
          title="Atendimento"
        />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AtendimentoPage() {
  const [status, setStatus]   = useState<ChatwootStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<ChatwootStatus>('/api/integrations/chatwoot/status')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PermissionGate module="atendimento" action="view">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : status?.connected && status.chatwootUrl ? (
        <ChatwootIframe url={status.chatwootUrl} />
      ) : (
        <NotConfigured />
      )}
    </PermissionGate>
  );
}
