// src/components/AccessDenied.tsx
// Tela padrão de acesso negado por permissão granular

'use client';

import { ShieldX } from 'lucide-react';

interface AccessDeniedProps {
  module?: string;
}

const MODULE_LABELS: Record<string, string> = {
  leads: 'Leads',
  kanban: 'Kanban',
  tasks: 'Tarefas',
  projects: 'Projetos',
  os: 'Ordens de Serviço',
  agenda: 'Agenda',
  reports: 'Relatórios',
  integrations: 'Integrações',
  settings: 'Configurações',
  users: 'Usuários',
  goals: 'Metas',
};

export default function AccessDenied({ module }: AccessDeniedProps) {
  const label = module ? MODULE_LABELS[module] || module : '';

  return (
    <div className="p-8">
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso negado</h2>
        <p className="text-gray-500 text-center max-w-md">
          Você não tem permissão para acessar {label ? `o módulo "${label}"` : 'esta página'}.
          Entre em contato com o administrador da sua organização.
        </p>
      </div>
    </div>
  );
}
