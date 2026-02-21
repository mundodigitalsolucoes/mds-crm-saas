// app/atendimento/page.tsx
// Página de Atendimento — Chatwoot embeddado em fullscreen via iframe

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

const CHATWOOT_URL = process.env.NEXT_PUBLIC_CHATWOOT_URL ?? '';

export const metadata = {
  title: 'Atendimento | MDS CRM',
};

export default async function AtendimentoPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/login');

  if (!CHATWOOT_URL) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
        <p className="text-lg font-medium">Chatwoot não configurado.</p>
        <p className="text-sm">
          Defina a variável de ambiente{' '}
          <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_CHATWOOT_URL</code>{' '}
          com a URL da sua instância.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <h1 className="text-xl font-semibold text-gray-800">Atendimento</h1>
        <span className="text-sm text-gray-400 ml-1">— Chatwoot</span>
      </div>

      {/* Iframe fullscreen */}
      <div className="flex-1 relative">
        <iframe
          src={CHATWOOT_URL}
          className="absolute inset-0 w-full h-full border-0"
          allow="microphone; camera; clipboard-write"
          title="Chatwoot Atendimento"
        />
      </div>
    </div>
  );
}
