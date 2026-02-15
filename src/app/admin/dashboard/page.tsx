'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Users,
  Target,
  FolderKanban,
  CheckSquare,
  FileText,
  TrendingUp,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

/**
 * Dashboard do SuperAdmin
 * Exibe KPIs globais do sistema
 */

// Tipagens
interface KPIs {
  totalOrganizations: number;
  totalUsers: number;
  totalLeads: number;
  totalProjects: number;
  totalTasks: number;
  totalServiceOrders: number;
  recentOrganizations: number;
  recentUsers: number;
  recentLeads: number;
}

interface PipelineItem {
  status: string;
  count: number;
}

interface TopOrg {
  id: string;
  name: string;
  plan: string | null;
  createdAt: string;
  users: number;
  leads: number;
}

interface DashboardData {
  kpis: KPIs;
  pipeline: PipelineItem[];
  topOrganizations: TopOrg[];
}

// Labels e cores do pipeline
const pipelineLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'bg-blue-500' },
  contacted: { label: 'Contatado', color: 'bg-cyan-500' },
  qualified: { label: 'Qualificado', color: 'bg-yellow-500' },
  proposal: { label: 'Proposta', color: 'bg-orange-500' },
  negotiation: { label: 'Negociação', color: 'bg-purple-500' },
  won: { label: 'Ganho', color: 'bg-green-500' },
  lost: { label: 'Perdido', color: 'bg-red-500' },
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) throw new Error('Erro ao carregar dados');
      const json = await res.json();
      setData(json);
    } catch {
      setError('Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-gray-500 text-sm">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-red-400">{error || 'Erro desconhecido'}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const { kpis, pipeline, topOrganizations } = data;

  // Total do pipeline para calcular porcentagem das barras
  const pipelineTotal = pipeline.reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Visão geral de todo o sistema</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* KPI Cards - Grid principal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Organizações"
          value={kpis.totalOrganizations}
          subtitle={`+${kpis.recentOrganizations} últimos 30 dias`}
          icon={<Building2 className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          title="Usuários"
          value={kpis.totalUsers}
          subtitle={`+${kpis.recentUsers} últimos 30 dias`}
          icon={<Users className="w-5 h-5" />}
          color="cyan"
        />
        <KPICard
          title="Leads"
          value={kpis.totalLeads}
          subtitle={`+${kpis.recentLeads} últimos 30 dias`}
          icon={<Target className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="Projetos"
          value={kpis.totalProjects}
          icon={<FolderKanban className="w-5 h-5" />}
          color="purple"
        />
        <KPICard
          title="Tarefas"
          value={kpis.totalTasks}
          icon={<CheckSquare className="w-5 h-5" />}
          color="yellow"
        />
        <KPICard
          title="Ordens de Serviço"
          value={kpis.totalServiceOrders}
          icon={<FileText className="w-5 h-5" />}
          color="orange"
        />
      </div>

      {/* Segunda linha: Pipeline + Top Orgs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Global */}
        <div className="bg-gray-950 border border-blue-900/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Pipeline Global</h3>
            <span className="text-xs text-gray-500 ml-auto">
              {pipelineTotal} leads total
            </span>
          </div>

          {pipeline.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">Nenhum lead cadastrado</p>
          ) : (
            <div className="space-y-3">
              {pipeline
                .sort((a, b) => b.count - a.count)
                .map((item) => {
                  const config = pipelineLabels[item.status] || {
                    label: item.status,
                    color: 'bg-gray-500',
                  };
                  const percentage = pipelineTotal > 0
                    ? Math.round((item.count / pipelineTotal) * 100)
                    : 0;

                  return (
                    <div key={item.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">{config.label}</span>
                        <span className="text-xs text-gray-500">
                          {item.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${config.color} rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Top Organizações */}
        <div className="bg-gray-950 border border-blue-900/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Top Organizações</h3>
          </div>

          {topOrganizations.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">Nenhuma organização</p>
          ) : (
            <div className="space-y-3">
              {topOrganizations.map((org, index) => (
                <div
                  key={org.id}
                  className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-800/50"
                >
                  {/* Posição */}
                  <span className="w-6 h-6 bg-blue-600/20 text-blue-400 text-xs font-bold rounded flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{org.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {org.plan || 'Sem plano'} • Criado em{' '}
                      {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {/* Métricas */}
                  <div className="flex gap-3 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{org.users}</p>
                      <p className="text-[10px] text-gray-500">Usuários</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{org.leads}</p>
                      <p className="text-[10px] text-gray-500">Leads</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Componente KPI Card
// ═══════════════════════════════════════

interface KPICardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'cyan' | 'green' | 'purple' | 'yellow' | 'orange';
}

const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue:   { bg: 'bg-blue-500/5',   border: 'border-blue-900/30',   text: 'text-blue-400',   iconBg: 'bg-blue-600/20' },
  cyan:   { bg: 'bg-cyan-500/5',   border: 'border-cyan-900/30',   text: 'text-cyan-400',   iconBg: 'bg-cyan-600/20' },
  green:  { bg: 'bg-green-500/5',  border: 'border-green-900/30',  text: 'text-green-400',  iconBg: 'bg-green-600/20' },
  purple: { bg: 'bg-purple-500/5', border: 'border-purple-900/30', text: 'text-purple-400', iconBg: 'bg-purple-600/20' },
  yellow: { bg: 'bg-yellow-500/5', border: 'border-yellow-900/30', text: 'text-yellow-400', iconBg: 'bg-yellow-600/20' },
  orange: { bg: 'bg-orange-500/5', border: 'border-orange-900/30', text: 'text-orange-400', iconBg: 'bg-orange-600/20' },
};

function KPICard({ title, value, subtitle, icon, color }: KPICardProps) {
  const c = colorMap[color];

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-5 transition-all hover:scale-[1.02]`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">
            {value.toLocaleString('pt-BR')}
          </p>
          {subtitle && (
            <p className={`text-xs ${c.text} mt-1.5`}>{subtitle}</p>
          )}
        </div>
        <div className={`${c.iconBg} p-2.5 rounded-lg ${c.text}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
