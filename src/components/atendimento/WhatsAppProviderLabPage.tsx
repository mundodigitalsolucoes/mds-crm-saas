'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  MessageCircle,
  Plug,
  QrCode,
  ShieldCheck,
} from 'lucide-react'

type MessageState = {
  type: 'success' | 'error' | 'info'
  text: string
} | null

type ProviderItem = {
  id: 'evolution' | 'whatsapp_cloud'
  title: string
  description: string
  status: 'active' | 'planned'
  setupMode: 'qr' | 'official_api'
  safeToUseNow: boolean
}

type OrgScope = {
  id: string
  name: string
  slug: string
  plan: string
  activeWhatsappInstances?: number
  maxWhatsappInstances?: number
}

type ProvidersResponse = {
  orgScope: OrgScope
  providers: ProviderItem[]
}

type ConnectResponse = {
  success?: boolean
  provider?: string
  providerTitle?: string
  instanceId?: string
  instanceName?: string
  label?: string | null
  chatwootInboxId?: number | null
  error?: string
  code?: string
  orgScope?: OrgScope
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function FeedbackBanner({
  msg,
  onClose,
}: {
  msg: MessageState
  onClose: () => void
}) {
  if (!msg) return null

  const styles = {
    success: {
      wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      icon: <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />,
    },
    error: {
      wrap: 'border-red-200 bg-red-50 text-red-800',
      icon: <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />,
    },
    info: {
      wrap: 'border-blue-200 bg-blue-50 text-blue-800',
      icon: <Info className="h-4 w-4 shrink-0 text-blue-600" />,
    },
  }

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm',
        styles[msg.type].wrap
      )}
    >
      <div className="flex items-start gap-2">
        {styles[msg.type].icon}
        <span className="text-sm leading-5">{msg.text}</span>
      </div>

      <button
        onClick={onClose}
        className="text-xs font-semibold opacity-70 hover:opacity-100"
      >
        Fechar
      </button>
    </div>
  )
}

function ProviderBadge({
  status,
  safeToUseNow,
}: {
  status: ProviderItem['status']
  safeToUseNow: boolean
}) {
  if (safeToUseNow) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        Ativo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
      <Info className="h-3.5 w-3.5" />
      {status === 'planned' ? 'Planejado' : 'Indisponível'}
    </span>
  )
}

function ProviderCard({
  provider,
  loading,
  onConnect,
}: {
  provider: ProviderItem
  loading: boolean
  onConnect: (provider: ProviderItem) => void
}) {
  const Icon = provider.setupMode === 'qr' ? QrCode : Plug

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
            <Icon className="h-6 w-6 text-[#374b89]" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#2f3453]">{provider.title}</h3>
            <p className="text-sm text-slate-500">{provider.id}</p>
          </div>
        </div>

        <ProviderBadge status={provider.status} safeToUseNow={provider.safeToUseNow} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{provider.description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {provider.setupMode === 'qr' ? 'Fluxo QR' : 'API oficial'}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Chatwoot-first
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Multi-org
        </span>
      </div>

      <button
        onClick={() => onConnect(provider)}
        disabled={loading}
        className={cn(
          'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
          provider.safeToUseNow
            ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
            : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : provider.safeToUseNow ? (
          <>
            <MessageCircle className="h-4 w-4" />
            Testar provider
          </>
        ) : (
          <>
            <Plug className="h-4 w-4" />
            Reservado para próxima etapa
          </>
        )}
      </button>
    </div>
  )
}

export default function WhatsAppProviderLabPage() {
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<MessageState>(null)
  const [lastResponse, setLastResponse] = useState<ConnectResponse | null>(null)

  const loadProviders = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await axios.get<ProvidersResponse>('/api/atendimento/canais/providers')
      setProviders(data.providers ?? [])
      setOrgScope(data.orgScope ?? null)
    } catch (err) {
      console.error(err)
      setProviders([])
      setOrgScope(null)
      setMessage({
        type: 'error',
        text: 'Não foi possível carregar os providers de WhatsApp.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  const activeCount = useMemo(
    () => providers.filter((item) => item.safeToUseNow).length,
    [providers]
  )

  const handleConnect = async (provider: ProviderItem) => {
    const defaultLabel =
      provider.id === 'evolution' ? 'WA Evolution Teste' : 'WA Cloud Teste'

    const labelInput = window.prompt(
      `Nome do canal para ${provider.title}:`,
      defaultLabel
    )

    if (labelInput === null) return

    const label = labelInput.trim() || defaultLabel

    setActionLoading(provider.id)

    try {
      const { data } = await axios.post<ConnectResponse>(
        '/api/atendimento/canais/connect',
        {
          provider: provider.id,
          label,
        }
      )

      setLastResponse(data)

      if (data.success) {
        setMessage({
          type: 'success',
          text:
            provider.id === 'evolution'
              ? `Provider ${provider.title} respondeu OK na org ${data.orgScope?.slug ?? '-'}. Instância ${data.instanceName ?? '-'} criada sem tocar no fluxo atual.`
              : `Provider ${provider.title} respondeu OK.`,
        })
        return
      }

      setMessage({
        type: 'info',
        text: `Provider ${provider.title} respondeu sem sucesso explícito.`,
      })
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao testar provider.'
        : 'Erro ao testar provider.'

      const responseData = axios.isAxiosError(err)
        ? (err.response?.data as ConnectResponse | undefined)
        : undefined

      setLastResponse(responseData ?? null)
      setMessage({
        type: provider.safeToUseNow ? 'error' : 'info',
        text: errorText,
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
                <Plug className="h-6 w-6 text-[#374b89]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2f3453]">
                  WhatsApp Providers Lab
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Página isolada da Fase 02 para testar providers sem mexer no fluxo atual.
                </p>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-[#374b89]" />
            {activeCount} provider ativo agora
          </div>
        </div>
      </div>

      {orgScope && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">Escopo da organização atual</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Organização
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">{orgScope.name}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Slug
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">{orgScope.slug}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plano
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">{orgScope.plan}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                WhatsApps ativos desta org
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">
                {orgScope.activeWhatsappInstances ?? 0}
                {typeof orgScope.maxWhatsappInstances === 'number'
                  ? ` / ${orgScope.maxWhatsappInstances <= 0 ? '∞' : orgScope.maxWhatsappInstances}`
                  : ''}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Tudo aqui deve operar somente no contexto da organização logada.
          </p>
        </div>
      )}

      <FeedbackBanner msg={message} onClose={() => setMessage(null)} />

      {lastResponse && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">Último retorno</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
{JSON.stringify(lastResponse, null, 2)}
          </pre>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              loading={actionLoading === provider.id}
              onConnect={handleConnect}
            />
          ))}
        </div>
      )}
    </div>
  )
}