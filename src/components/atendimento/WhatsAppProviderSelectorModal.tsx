'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  Info,
  Loader2,
  MessageCircle,
  Plug,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react'

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function ProviderBadge({
  provider,
}: {
  provider: ProviderItem
}) {
  if (provider.safeToUseNow) {
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
      Planejado
    </span>
  )
}

function ProviderCard({
  provider,
  actionLoading,
  onChoose,
}: {
  provider: ProviderItem
  actionLoading: boolean
  onChoose: (provider: ProviderItem) => void
}) {
  const Icon = provider.setupMode === 'qr' ? QrCode : Plug

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
            <Icon className="h-6 w-6 text-[#374b89]" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#2f3453]">{provider.title}</h3>
            <p className="text-sm text-slate-500">{provider.id}</p>
          </div>
        </div>

        <ProviderBadge provider={provider} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{provider.description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
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
        onClick={() => onChoose(provider)}
        disabled={actionLoading || !provider.safeToUseNow}
        className={cn(
          'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
          provider.safeToUseNow
            ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
            : 'bg-slate-900 text-white opacity-70 cursor-not-allowed'
        )}
      >
        {actionLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : provider.safeToUseNow ? (
          <>
            <MessageCircle className="h-4 w-4" />
            Continuar com este provider
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

export default function WhatsAppProviderSelectorModal({
  open,
  actionLoading,
  onClose,
  onSelectEvolution,
  onShowInfo,
}: {
  open: boolean
  actionLoading: boolean
  onClose: () => void
  onSelectEvolution: () => void
  onShowInfo: (text: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadProviders() {
      setLoading(true)
      setFetchError(null)

      try {
        const { data } = await axios.get<ProvidersResponse>('/api/atendimento/canais/providers')

        if (cancelled) return

        setProviders(data.providers ?? [])
        setOrgScope(data.orgScope ?? null)
      } catch (err) {
        console.error(err)

        if (cancelled) return

        const errorText = axios.isAxiosError(err)
          ? err.response?.data?.error ?? 'Não foi possível carregar os providers.'
          : 'Não foi possível carregar os providers.'

        setFetchError(errorText)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProviders()

    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const handleChoose = (provider: ProviderItem) => {
    if (provider.id === 'evolution') {
      onClose()
      onSelectEvolution()
      return
    }

    onShowInfo('WhatsApp Cloud API está reservado para a próxima etapa da Fase 02.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
                <Plug className="h-6 w-6 text-[#374b89]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#2f3453]">Escolher provider do WhatsApp</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Selecione a trilha do canal sem misturar Evolution com API oficial.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {orgScope && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Organização
                </p>
                <p className="mt-1 text-sm font-bold text-[#2f3453]">{orgScope.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Slug
                </p>
                <p className="mt-1 text-sm font-bold text-[#2f3453]">{orgScope.slug}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Plano
                </p>
                <p className="mt-1 text-sm font-bold text-[#2f3453]">{orgScope.plan}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  WhatsApps ativos
                </p>
                <p className="mt-1 text-sm font-bold text-[#2f3453]">
                  {orgScope.activeWhatsappInstances ?? 0}
                  {typeof orgScope.maxWhatsappInstances === 'number'
                    ? ` / ${orgScope.maxWhatsappInstances <= 0 ? '∞' : orgScope.maxWhatsappInstances}`
                    : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm font-medium text-red-700">{fetchError}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                actionLoading={actionLoading}
                onChoose={handleChoose}
              />
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}