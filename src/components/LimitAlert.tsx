// src/components/LimitAlert.tsx
// Alerta inline reutilizável para exibir dentro de modais quando limite atingido
// Suporta dois variants: 'limit' (recurso esgotado) e 'inactive' (trial expirado / plano inativo)
'use client';

import { AlertTriangle, Clock } from 'lucide-react';

interface LimitAlertProps {
  resource: string;
  usage?: string;
  planName?: string;
  variant?: 'limit' | 'inactive';
}

export default function LimitAlert({
  resource,
  usage,
  planName,
  variant = 'limit',
}: LimitAlertProps) {
  if (variant === 'inactive') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <Clock className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-amber-900 mb-1">
              Período de teste expirado
            </h3>
            <p className="text-sm text-amber-700">
              Seu período de teste expirou. Entre em contato com o suporte para continuar
              utilizando o sistema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-medium text-red-900 mb-1">
            Limite de {resource} atingido
          </h3>
          <p className="text-sm text-red-700">
            Seu plano{planName ? ` (${planName})` : ''} atingiu o limite de{' '}
            <strong>{resource}</strong>
            {usage ? ` (${usage})` : ''}.{' '}
            Entre em contato para fazer upgrade.
          </p>
        </div>
      </div>
    </div>
  );
}
