// src/app/(app)/settings/billing/page.tsx
// Página de gerenciamento de assinatura — status, plano, vencimento

'use client'

import { useUsage } from '@/hooks/useUsage'
import { trialDaysLeft, trialMessage } from '@/lib/trial'
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  Zap,
} from 'lucide-react'

// ── helpers visuais ──────────────────────────────────────────────────

const PLAN_LABEL: Record<string, string> = {
  trial:        'Trial Gratuito',
  starter:      'Starter',
  professional: 'Professional',
  enterprise:   'Enterprise',
}

const STATUS_CONFIG: Record<string, {
  label: string
  icon: React.ReactNode
  className: string
}> = {
  active: {
    label: 'Ativo',
    icon: <CheckCircle className="w-4 h-4" />,
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  trial: {
    label: 'Trial',
    icon: <Clock className="w-4 h-4" />,
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  past_due: {
    label: 'Pagamento pendente',
    icon: <AlertTriangle className="w-4 h-4" />,
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  cancelled: {
    label: 'Cancelado',
    icon: <XCircle className="w-4 h-4" />,
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  trial_expired: {
    label: 'Trial expirado',
    icon: <XCircle className="w-4 h-4" />,
    className: 'bg-red-100 text-red-700 border-red-200',
  },
}

// ── componente ───────────────────────────────────────────────────────

export default function BillingPage() {
  const { data, isLoading } = useUsage()

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!data) return null

  const planLabel  = PLAN_LABEL[data.plan]  ?? data.plan
  const statusCfg  = STATUS_CONFIG[data.planStatus] ?? STATUS_CONFIG.active
  const daysLeft   = trialDaysLeft({ plan: data.plan, trialEndsAt: data.trialEndsAt })
  const trialMsg   = daysLeft !== null ? trialMessage(daysLeft) : null

  const manageUrl  = process.env.NEXT_PUBLIC_ASAAS_MANAGE_URL ?? '#'
  const upgradeUrl = process.env.NEXT_PUBLIC_UPGRADE_URL      ?? '#'

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Assinatura</h1>
        <p className="text-gray-600 mt-1">
          Gerencie seu plano e informações de cobrança
        </p>
      </div>

      {/* Banner trial */}
      {trialMsg && (
        <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
          daysLeft === 0
            ? 'bg-red-50 border-red-200 text-red-700'
            : daysLeft! <= 3
            ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <Clock className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{trialMsg}</p>
            <p className="text-xs mt-0.5 opacity-80">
              Faça upgrade para continuar usando sem interrupções.
            </p>
          </div>
          <a
            href={upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition"
          >
            <Zap className="w-3.5 h-3.5" />
            Fazer upgrade
          </a>
        </div>
      )}

      {/* Banner past_due */}
      {data.planStatus === 'past_due' && (
        <div className="mb-6 p-4 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-800 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Pagamento pendente</p>
            <p className="text-xs mt-0.5 opacity-80">
              Regularize seu pagamento para evitar a suspensão da conta.
            </p>
          </div>
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium rounded-lg transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Regularizar
          </a>
        </div>
      )}

      {/* Card — Plano atual */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <CreditCard className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Plano atual</h2>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-3xl font-bold text-gray-900">{planLabel}</p>
            {data.trialEndsAt && data.plan === 'trial' && (
              <p className="text-sm text-gray-500 mt-1">
                Trial válido até{' '}
                {new Date(data.trialEndsAt).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>

          {/* Badge de status */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${statusCfg.className}`}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Card — Uso atual */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Uso atual</h2>

        <div className="grid grid-cols-2 gap-4">
          {(Object.entries(data.resources) as [string, { current: number; max: number; percentage: number }][]).map(([key, r]) => {
            const labels: Record<string, string> = {
              users:    'Usuários',
              leads:    'Leads',
              projects: 'Projetos',
              os:       'Ordens de Serviço',
            }
            const pct     = Math.min(r.percentage, 100)
            const isLimit = r.max > 0 && r.current >= r.max

            return (
              <div key={key} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{labels[key] ?? key}</span>
                  <span className={`text-xs font-semibold ${isLimit ? 'text-red-600' : 'text-gray-500'}`}>
                    {r.max <= 0 ? `${r.current} / ∞` : `${r.current} / ${r.max}`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      isLimit ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: r.max <= 0 ? '0%' : `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Card — Ações */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Gerenciar assinatura</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Upgrade — sempre visível se não for enterprise */}
          {data.plan !== 'enterprise' && (
            <a
              href={upgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
            >
              <Zap className="w-4 h-4" />
              Fazer upgrade
            </a>
          )}

          {/* Gerenciar — apenas se tiver assinatura ativa */}
          {['active', 'past_due'].includes(data.planStatus) && data.plan !== 'trial' && (
            <a
              href={manageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
            >
              <ExternalLink className="w-4 h-4" />
              Gerenciar no portal
            </a>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Pagamentos e faturas são gerenciados via Asaas. Dúvidas? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  )
}
