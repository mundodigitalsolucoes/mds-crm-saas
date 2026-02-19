// src/components/LimitAlert.tsx
// Alerta inline reutilizável para exibir dentro de modais quando limite atingido
'use client';

import { AlertTriangle } from 'lucide-react';

interface LimitAlertProps {
  resource: string;
  usage: string;
  planName?: string;
}

export default function LimitAlert({ resource, usage, planName }: LimitAlertProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-medium text-red-900 mb-1">
            Limite de {resource} atingido
          </h3>
          <p className="text-sm text-red-700">
            Seu plano{planName ? ` (${planName})` : ''} permite no máximo <strong>{usage}</strong>.
            Entre em contato para fazer upgrade.
          </p>
        </div>
      </div>
    </div>
  );
}
