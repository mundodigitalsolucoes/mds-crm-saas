// src/components/UsageBanner.tsx
// Banner compacto de uso para exibir na Sidebar
// Mostra o recurso mais próximo do limite + barra de progresso
'use client';

import { useUsage } from '@/hooks/useUsage';
import { AlertTriangle, TrendingUp } from 'lucide-react';

export default function UsageBanner() {
  const { data, isLoading } = useUsage();

  if (isLoading || !data) return null;

  // Encontrar o recurso com maior % de uso
  const resources = [
    { key: 'leads' as const, label: 'Leads' },
    { key: 'projects' as const, label: 'Projetos' },
    { key: 'os' as const, label: 'OS' },
    { key: 'users' as const, label: 'Usuários' },
  ]
    .map((r) => ({
      ...r,
      ...data.resources[r.key], // current, max, percentage
    }))
    .filter((r) => r.max > 0); // Remove ilimitados (max <= 0)

  if (resources.length === 0) return null; // Tudo ilimitado

  // Ordenar por % decrescente e pegar o mais crítico
  const sorted = resources.sort((a, b) => b.percentage - a.percentage);
  const critical = sorted[0];

  // Só mostra se >= 70% de uso
  if (critical.percentage < 70) return null;

  const isOver90 = critical.percentage >= 90;
  const isAt100 = critical.percentage >= 100;

  return (
    <div
      className={`mx-3 mb-3 p-3 rounded-lg border ${
        isAt100
          ? 'bg-red-900/30 border-red-700/50'
          : isOver90
            ? 'bg-yellow-900/30 border-yellow-700/50'
            : 'bg-indigo-900/30 border-indigo-600/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {isAt100 ? (
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
        ) : (
          <TrendingUp size={14} className="text-yellow-400 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-white truncate">
          {isAt100
            ? `Limite de ${critical.label} atingido`
            : `${critical.label}: ${critical.percentage}% usado`}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-indigo-950/50 rounded-full h-1.5 mb-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            isAt100 ? 'bg-red-500' : isOver90 ? 'bg-yellow-500' : 'bg-indigo-400'
          }`}
          style={{ width: `${Math.min(critical.percentage, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-indigo-300">
          {critical.current} / {critical.max}
        </span>
        <span
          className={`text-[10px] font-medium ${
            isAt100 ? 'text-red-400' : 'text-indigo-300'
          }`}
        >
          {data.plan}
        </span>
      </div>
    </div>
  );
}
