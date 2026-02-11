'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Megaphone,
  DollarSign,
  Users,
  MousePointerClick,
  Eye,
  Radio,
  Globe,
  MessageCircle,
  Instagram,
  CalendarRange,
  Info,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  LucideIcon,
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLeadsStore } from '@/store/leadsStore';

type TabKey = 'sales' | 'marketing';
type PeriodPreset = 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

interface ReportsConfig {
  wonStageIds: string[];
  lostStageIds: string[];
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function safeNumber(n: unknown) {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="bg-white border rounded-xl p-5 flex items-start justify-between">
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
        {subtitle ? <div className="text-xs text-gray-500 mt-1">{subtitle}</div> : null}
      </div>
      <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700">
        <Icon size={20} />
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description ? <p className="text-sm text-gray-500 mt-1">{description}</p> : null}
    </div>
  );
}

function clampISODate(value: string) {
  if (!value) return '';
  return value.slice(0, 10);
}

function withinRange(isoDate: string, fromISO: string, toISO: string) {
  try {
    const d = parseISO(isoDate);
    const from = parseISO(fromISO);
    const to = parseISO(toISO);

    return (
      (isAfter(d, from) || format(d, 'yyyy-MM-dd') === format(from, 'yyyy-MM-dd')) &&
      (isBefore(d, to) || format(d, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd'))
    );
  } catch {
    return false;
  }
}

// Hook para configuração de relatórios (localStorage por enquanto)
function useReportsConfig(userKey = 'default'): [ReportsConfig, (config: ReportsConfig) => void] {
  const [config, setConfig] = useState<ReportsConfig>({
    wonStageIds: [],
    lostStageIds: [],
  });

  const storageKey = `mdscrm:reportsConfig:${userKey}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ReportsConfig;
        setConfig(parsed);
      }
    } catch (error) {
      console.warn('Erro ao carregar configuração de relatórios:', error);
    }
  }, [storageKey]);

  const updateConfig = (newConfig: ReportsConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
    } catch (error) {
      console.warn('Erro ao salvar configuração de relatórios:', error);
    }
  };

  return [config, updateConfig];
}

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>('sales');
  const [showMetricsConfig, setShowMetricsConfig] = useState(false);

  const [reportsConfig, setReportsConfig] = useReportsConfig('default');

  // ======= PERÍODO (global) =======
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('thisMonth');

  const today = new Date();
  const defaultFrom = format(startOfMonth(today), 'yyyy-MM-dd');
  const defaultTo = format(endOfMonth(today), 'yyyy-MM-dd');

  const [customFrom, setCustomFrom] = useState<string>(defaultFrom);
  const [customTo, setCustomTo] = useState<string>(defaultTo);

  const period = useMemo(() => {
    if (periodPreset === 'last7') {
      const from = format(subDays(today, 6), 'yyyy-MM-dd');
      const to = format(today, 'yyyy-MM-dd');
      return { from, to, label: 'Últimos 7 dias' };
    }

    if (periodPreset === 'last30') {
      const from = format(subDays(today, 29), 'yyyy-MM-dd');
      const to = format(today, 'yyyy-MM-dd');
      return { from, to, label: 'Últimos 30 dias' };
    }

    if (periodPreset === 'lastMonth') {
      const base = subMonths(today, 1);
      const from = format(startOfMonth(base), 'yyyy-MM-dd');
      const to = format(endOfMonth(base), 'yyyy-MM-dd');
      return { from, to, label: 'Mês passado' };
    }

    if (periodPreset === 'custom') {
      const from = clampISODate(customFrom) || defaultFrom;
      const to = clampISODate(customTo) || defaultTo;
      return { from, to, label: 'Personalizado' };
    }

    return { from: defaultFrom, to: defaultTo, label: 'Este mês' };
  }, [periodPreset, customFrom, customTo, defaultFrom, defaultTo, today]);

  // ======= DADOS DA STORE =======
  const { leads, stages, isLoading, fetchLeads } = useLeadsStore();

  // Busca leads ao montar
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Filtra por período usando createdAt (campo do Prisma)
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!l.createdAt) return true;
      return withinRange(l.createdAt, period.from, period.to);
    });
  }, [leads, period.from, period.to]);

  const stagesSorted = useMemo(() => {
    return [...stages].sort((a, b) => a.order - b.order);
  }, [stages]);

  const stageStats = useMemo(() => {
    const countsByStageId: Record<string, number> = {};
    for (const st of stagesSorted) countsByStageId[st.id] = 0;

    for (const l of filteredLeads) {
      const key = l.status;
      countsByStageId[key] = (countsByStageId[key] || 0) + 1;
    }

    const total = filteredLeads.length;
    const max = Math.max(1, ...Object.values(countsByStageId));

    const rows = stagesSorted.map((st) => {
      const count = countsByStageId[st.id] || 0;
      const isWon = reportsConfig.wonStageIds.includes(st.id);
      const isLost = reportsConfig.lostStageIds.includes(st.id);

      return {
        stageId: st.id,
        title: st.title,
        color: st.color,
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
        bar: (count / max) * 100,
        isWon,
        isLost,
      };
    });

    return { total, rows };
  }, [filteredLeads, stagesSorted, reportsConfig]);

  const conversionStats = useMemo(() => {
    const wonLeads = filteredLeads.filter((l) => reportsConfig.wonStageIds.includes(l.status));
    const lostLeads = filteredLeads.filter((l) => reportsConfig.lostStageIds.includes(l.status));
    const total = filteredLeads.length;
    const wonCount = wonLeads.length;
    const lostCount = lostLeads.length;

    const conversionRate = total > 0 ? (wonCount / total) * 100 : 0;

    return {
      wonCount,
      lostCount,
      total,
      conversionRate,
      hasConfig: reportsConfig.wonStageIds.length > 0,
    };
  }, [filteredLeads, reportsConfig]);

  // Usa l.value (campo Prisma) em vez de l.valor
  const revenue = useMemo(() => {
    const totalPipeline = filteredLeads.reduce(
      (acc, l) => acc + safeNumber(l.value),
      0
    );

    const wonRevenue = filteredLeads
      .filter((l) => reportsConfig.wonStageIds.includes(l.status))
      .reduce((acc, l) => acc + safeNumber(l.value), 0);

    const lostRevenue = filteredLeads
      .filter((l) => reportsConfig.lostStageIds.includes(l.status))
      .reduce((acc, l) => acc + safeNumber(l.value), 0);

    return { totalPipeline, wonRevenue, lostRevenue };
  }, [filteredLeads, reportsConfig]);

  const handleStageConfigToggle = (stageId: string, type: 'won' | 'lost') => {
    if (type === 'won') {
      const newWonIds = reportsConfig.wonStageIds.includes(stageId)
        ? reportsConfig.wonStageIds.filter((id) => id !== stageId)
        : [...reportsConfig.wonStageIds, stageId];

      setReportsConfig({ ...reportsConfig, wonStageIds: newWonIds });
    } else {
      const newLostIds = reportsConfig.lostStageIds.includes(stageId)
        ? reportsConfig.lostStageIds.filter((id) => id !== stageId)
        : [...reportsConfig.lostStageIds, stageId];

      setReportsConfig({ ...reportsConfig, lostStageIds: newLostIds });
    }
  };

  // ======= MARKETING (manual por enquanto) =======
  const [marketingInvestment, setMarketingInvestment] = useState<string>('0');
  const [marketingMetrics, setMarketingMetrics] = useState({
    leads: 0,
    whatsappMessages: 0,
    cpc: 0,
    cpm: 0,
    alcance: 0,
    impressoes: 0,
    visitasSite: 0,
    seguidoresInstagram: 0,
  });

  const investment = useMemo(() => safeNumber(marketingInvestment), [marketingInvestment]);

  const derivedMarketing = useMemo(() => {
    const leadsN = safeNumber(marketingMetrics.leads);
    const whatsapp = safeNumber(marketingMetrics.whatsappMessages);
    const visitas = safeNumber(marketingMetrics.visitasSite);
    const imp = safeNumber(marketingMetrics.impressoes);

    const cpl = leadsN > 0 ? investment / leadsN : 0;
    const cpMsg = whatsapp > 0 ? investment / whatsapp : 0;
    const ctr = imp > 0 ? (visitas / imp) * 100 : 0;

    return { cpl, cpMsg, ctr };
  }, [marketingMetrics, investment]);

  const periodHuman = useMemo(() => {
    try {
      const from = parseISO(period.from);
      const to = parseISO(period.to);
      return `${format(from, 'dd/MM/yyyy', { locale: ptBR })} → ${format(to, 'dd/MM/yyyy', { locale: ptBR })}`;
    } catch {
      return `${period.from} → ${period.to}`;
    }
  }, [period.from, period.to]);

  // ======= LOADING =======
  if (isLoading && leads.length === 0) {
    return (
      <div className="p-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500">Acompanhe performance de vendas e marketing.</p>
        </div>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-indigo-600 mr-3" size={28} />
          <span className="text-gray-600 text-lg">Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500">Acompanhe performance de vendas e marketing por usuário.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('sales')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === 'sales'
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <TrendingUp size={16} /> Vendas
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('marketing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === 'marketing'
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Megaphone size={16} /> Marketing
            </span>
          </button>
        </div>
      </div>

      {/* Período (global) */}
      <div className="bg-white border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-gray-700">
            <CalendarRange size={18} className="text-indigo-600" />
            <div className="text-sm">
              <span className="font-medium">Período:</span>{' '}
              <span className="text-gray-600">{period.label}</span>{' '}
              <span className="text-gray-400">({periodHuman})</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
              className="px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="last7">Últimos 7 dias</option>
              <option value="last30">Últimos 30 dias</option>
              <option value="thisMonth">Este mês</option>
              <option value="lastMonth">Mês passado</option>
              <option value="custom">Personalizado</option>
            </select>

            {periodPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <span className="text-gray-400 text-sm">até</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== SALES TAB ==================== */}
      {tab === 'sales' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <SectionTitle
              title="Relatório de Vendas"
              description="Integrado ao seu Pipeline — dados em tempo real do banco de dados."
            />

            <button
              onClick={() => setShowMetricsConfig(!showMetricsConfig)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Settings size={16} />
              Configurar métricas
            </button>
          </div>

          {/* Configuração de métricas (expansível) */}
          {showMetricsConfig && (
            <div className="bg-white border rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Configurar métricas de conversão</h3>
              <p className="text-sm text-gray-600 mb-4">
                Marque quais estágios representam <strong>leads ganhos</strong> e <strong>leads perdidos</strong>{' '}
                para calcular a taxa de conversão correta do seu pipeline.
              </p>

              {stagesSorted.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Nenhum estágio encontrado. Crie estágios no Kanban primeiro.
                </div>
              ) : (
                <div className="space-y-3">
                  {stagesSorted.map((stage) => (
                    <div key={stage.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full bg-${stage.color}-400`}
                          title={`Cor: ${stage.color}`}
                        />
                        <span className="font-medium text-gray-800">{stage.title}</span>
                        <span className="text-xs text-gray-500">
                          ({stageStats.rows.find((r) => r.stageId === stage.id)?.count ?? 0} leads)
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reportsConfig.wonStageIds.includes(stage.id)}
                            onChange={() => handleStageConfigToggle(stage.id, 'won')}
                            className="rounded border-gray-300"
                          />
                          <CheckCircle size={16} className="text-green-600" />
                          <span className="text-sm text-gray-700">Ganho</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reportsConfig.lostStageIds.includes(stage.id)}
                            onChange={() => handleStageConfigToggle(stage.id, 'lost')}
                            className="rounded border-gray-300"
                          />
                          <XCircle size={16} className="text-red-600" />
                          <span className="text-sm text-gray-700">Perdido</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                <strong>Nota:</strong> A configuração é salva por usuário no navegador.
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              title="Leads no funil"
              value={String(stageStats.total ?? 0)}
              subtitle={`Filtrado por data de criação (${periodHuman})`}
              icon={Users}
            />
            <KpiCard
              title="Oportunidades"
              value={String(stageStats.total ?? 0)}
              subtitle="(Por enquanto: 1 lead = 1 oportunidade)"
              icon={BarChart3}
            />
            <KpiCard
              title="Taxa de conversão"
              value={
                conversionStats.hasConfig
                  ? `${conversionStats.conversionRate.toFixed(1)}%`
                  : '—'
              }
              subtitle={
                conversionStats.hasConfig
                  ? `${conversionStats.wonCount} ganho(s) / ${conversionStats.total} leads`
                  : 'Configure os estágios de ganho/perda'
              }
              icon={TrendingUp}
            />
            <KpiCard
              title="Receita estimada (funil)"
              value={formatBRL(revenue.totalPipeline)}
              subtitle={
                reportsConfig.wonStageIds.length > 0
                  ? `Receita ganha: ${formatBRL(revenue.wonRevenue)}`
                  : 'Configure estágios de ganho para ver receita ganha'
              }
              icon={DollarSign}
            />
          </div>

          {/* Leads por estágio */}
          <div className="bg-white border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Leads por estágio</h3>
                <p className="text-sm text-gray-500">
                  Distribuição do funil com base no status atual do lead.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Info size={14} />
                <span>
                  Funil com <span className="font-medium">{stagesSorted.length}</span> estágio(s).
                </span>
              </div>
            </div>

            {stagesSorted.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum estágio encontrado.</div>
            ) : (
              <div className="space-y-3">
                {stageStats.rows.map((row) => (
                  <div key={row.stageId} className="flex items-center gap-4">
                    <div className="w-40 min-w-40">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-800 truncate">{row.title}</div>
                        {row.isWon && (
                          <span title="Estágio de ganho">
                            <CheckCircle size={14} className="text-green-600" />
                          </span>
                        )}
                        {row.isLost && (
                          <span title="Estágio de perda">
                            <XCircle size={14} className="text-red-600" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.count} lead(s) • {row.pct.toFixed(1)}%
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            row.isWon ? 'bg-green-500' : row.isLost ? 'bg-red-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${row.bar}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-12 text-right text-sm font-semibold text-gray-900">{row.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MARKETING TAB ==================== */}
      {tab === 'marketing' && (
        <div className="space-y-8">
          <SectionTitle
            title="Relatório de Marketing"
            description="Lançamento manual por período selecionado. Próximo passo: integrações nativas com Google Ads, Meta Ads e Google Meu Negócio."
          />

          <div className="bg-white border rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-semibold text-gray-900">Lançamento de métricas</h3>
                <p className="text-sm text-gray-500">
                  Período atual: <span className="font-medium">{periodHuman}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Investimento (R$)</label>
                <input
                  value={marketingInvestment}
                  onChange={(e) => setMarketingInvestment(e.target.value)}
                  inputMode="decimal"
                  className="w-40 px-3 py-2 border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <Users size={16} className="text-indigo-600" />
                  Leads
                </div>
                <input
                  type="number"
                  value={marketingMetrics.leads}
                  onChange={(e) => setMarketingMetrics((s) => ({ ...s, leads: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <MessageCircle size={16} className="text-green-600" />
                  Mensagens no WhatsApp
                </div>
                <input
                  type="number"
                  value={marketingMetrics.whatsappMessages}
                  onChange={(e) =>
                    setMarketingMetrics((s) => ({ ...s, whatsappMessages: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <MousePointerClick size={16} className="text-indigo-600" />
                  CPC (R$)
                </div>
                <input
                  inputMode="decimal"
                  value={marketingMetrics.cpc}
                  onChange={(e) => setMarketingMetrics((s) => ({ ...s, cpc: safeNumber(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                  placeholder="0"
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <Radio size={16} className="text-indigo-600" />
                  CPM (R$)
                </div>
                <input
                  inputMode="decimal"
                  value={marketingMetrics.cpm}
                  onChange={(e) => setMarketingMetrics((s) => ({ ...s, cpm: safeNumber(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                  placeholder="0"
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <Eye size={16} className="text-indigo-600" />
                  Alcance
                </div>
                <input
                  type="number"
                  value={marketingMetrics.alcance}
                  onChange={(e) => setMarketingMetrics((s) => ({ ...s, alcance: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                />
              </div>

              <div className="bg-gray-50 border rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-600" />
                  Impressões
                </div>
                <input
                  type="number"
                  value={marketingMetrics.impressoes}
                  onChange={(e) => setMarketingMetrics((s) => ({ ...s, impressoes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <Globe size={16} className="text-indigo-600" />
                  Visitas ao site
                </div>
                <input
                  type="number"
                  value={marketingMetrics.visitasSite}
                  onChange={(e) => setMarketingMetrics((s) => ({ ...s, visitasSite: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                  <Instagram size={16} className="text-pink-600" />
                  Seguidores Instagram
                </div>
                <input
                  type="number"
                  value={marketingMetrics.seguidoresInstagram}
                  onChange={(e) =>
                    setMarketingMetrics((s) => ({ ...s, seguidoresInstagram: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Marketing KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard title="Investimento" value={formatBRL(investment)} subtitle="Lançamento manual" icon={DollarSign} />
            <KpiCard
              title="CPL (custo por lead)"
              value={derivedMarketing.cpl ? formatBRL(derivedMarketing.cpl) : '—'}
              subtitle="Investimento / Leads"
              icon={Users}
            />
            <KpiCard
              title="Custo por mensagem (WhatsApp)"
              value={derivedMarketing.cpMsg ? formatBRL(derivedMarketing.cpMsg) : '—'}
              subtitle="Investimento / Mensagens"
              icon={MessageCircle}
            />
            <KpiCard
              title="CTR (aprox.)"
              value={derivedMarketing.ctr ? `${derivedMarketing.ctr.toFixed(2)}%` : '—'}
              subtitle="(Visitas ao site / Impressões)"
              icon={MousePointerClick}
            />
          </div>

          {/* Próximos passos */}
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Integrações nativas (próximo passo)</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>Vamos integrar com:</p>
              <ul className="list-disc pl-5">
                <li>Google Ads</li>
                <li>Meta Ads</li>
                <li>Google Meu Negócio (Google Business Profile)</li>
              </ul>
              <p className="text-gray-500">
                Para isso, precisamos configurar OAuth (tokens) e criar rotas API no Next. Fazemos isso em etapas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
