// src/app/(app)/atendimento/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PermissionGate } from '@/components/PermissionGate';
import axios from 'axios';

interface ChatwootCredentials {
  organizationId: string;
  userId: string;
  cacheKey: string;
  ssoUrl: string;
  chatwootUrl: string;
  chatwootAccountId: number;
}

function NotConfigured() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-gray-400">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800">
        <MessageSquare className="h-8 w-8 text-gray-500" />
      </div>

      <div className="text-center">
        <h2 className="mb-1 text-lg font-semibold text-white">
          Atendimento indisponível
        </h2>
        <p className="max-w-sm text-sm text-gray-400">
          Não foi possível iniciar a sessão automática do Chatwoot para esta organização.
        </p>
      </div>

      <Link
        href="/settings/integrations"
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        <Settings className="h-4 w-4" />
        Ver Integrações
      </Link>
    </div>
  );
}

function ChatwootIframe({ creds }: { creds: ChatwootCredentials }) {
  const { ssoUrl, organizationId, userId, cacheKey, chatwootAccountId } = creds;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [booting, setBooting] = useState(true);

  const cleanupIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      iframe.src = 'about:blank';
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    setBooting(true);

    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.src = 'about:blank';

    const timer = window.setTimeout(() => {
      if (!iframeRef.current) return;
      iframeRef.current.src = ssoUrl;
    }, 60);

    return () => {
      window.clearTimeout(timer);
      cleanupIframe();
    };
  }, [cacheKey, ssoUrl, cleanupIframe]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setBooting(false);
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [cacheKey, ssoUrl]);

  useEffect(() => {
    const handlePageHide = () => cleanupIframe();
    const handleBeforeUnload = () => cleanupIframe();

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cleanupIframe]);

  return (
    <div className="relative h-full w-full">
      {booting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 'var(--app-sidebar-width, 288px)',
            right: 0,
            bottom: 0,
            width: 'calc(100vw - var(--app-sidebar-width, 288px))',
            zIndex: 50,
          }}
          className="flex items-center justify-center bg-gray-950/60"
        >
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      )}

      <iframe
        key={cacheKey}
        ref={iframeRef}
        src="about:blank"
        style={{
          position: 'fixed',
          top: 0,
          left: 'var(--app-sidebar-width, 288px)',
          right: 0,
          bottom: 0,
          width: 'calc(100vw - var(--app-sidebar-width, 288px))',
          height: '100vh',
          border: 'none',
          zIndex: 40,
          background: '#111827',
        }}
        allow="microphone; camera; clipboard-write"
        title={`Atendimento-${organizationId}-${userId}-${chatwootAccountId}`}
      />
    </div>
  );
}

export default function AtendimentoPage() {
  const [creds, setCreds] = useState<ChatwootCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestSeqRef = useRef(0);

  const loadCredentials = useCallback(async () => {
    const requestId = ++requestSeqRef.current;

    setLoading(true);
    setError(false);
    setCreds(null);

    try {
      const { data } = await axios.get<ChatwootCredentials>(
        '/api/integrations/chatwoot/credentials',
        {
          params: {
            t: Date.now(),
          },
          headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
          },
        }
      );

      if (requestId !== requestSeqRef.current) return;

      setCreds(data);
      setError(false);
    } catch {
      if (requestId !== requestSeqRef.current) return;

      setCreds(null);
      setError(true);
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  return (
    <PermissionGate module="atendimento" action="view">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : error || !creds ? (
        <NotConfigured />
      ) : (
        <ChatwootIframe key={creds.cacheKey} creds={creds} />
      )}
    </PermissionGate>
  );
}