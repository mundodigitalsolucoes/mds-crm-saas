'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  CheckCircle,
  Copy,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import AtendimentoWidgetPreview from '@/components/widget/AtendimentoWidgetPreview'

type MessageState = {
  type: 'success' | 'info' | 'error'
  text: string
} | null

type WidgetPosition = 'right' | 'left'

type WidgetConfig = {
  organizationName: string
  title: string
  subtitle: string
  ctaLabel: string
  online: boolean
  position: WidgetPosition
  buttonLabel: string
  primaryActionUrl: string
  primaryColor: string
  accentColor: string
}

type OrgScope = {
  id: string
  name: string
  slug: string
  plan: string
}

type WidgetConfigResponse = {
  orgScope: OrgScope
  config: WidgetConfig
  defaults: WidgetConfig
  savedAt: string
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function formatDateTime(value: string | null) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
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
    info: {
      wrap: 'border-blue-200 bg-blue-50 text-blue-800',
      icon: <Info className="h-4 w-4 shrink-0 text-blue-600" />,
    },
    error: {
      wrap: 'border-red-200 bg-red-50 text-red-800',
      icon: <Info className="h-4 w-4 shrink-0 text-red-600" />,
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

const FALLBACK_DEFAULTS: WidgetConfig = {
  organizationName: 'Mundo Digital Soluções',
  title: 'Fale com nosso Atendimento',
  subtitle:
    'Tire dúvidas, peça suporte ou inicie seu atendimento comercial por este canal.',
  ctaLabel: 'Abrir Atendimento',
  online: true,
  position: 'right',
  buttonLabel: 'Atendimento',
  primaryActionUrl: 'https://crm.mundodigitalsolucoes.com.br',
  primaryColor: '#374b89',
  accentColor: '#2f3453',
}

export default function AtendimentoWidgetConfigPage() {
  const [message, setMessage] = useState<MessageState>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const [defaults, setDefaults] = useState<WidgetConfig>(FALLBACK_DEFAULTS)
  const [config, setConfig] = useState<WidgetConfig>(FALLBACK_DEFAULTS)

  const loadConfig = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await axios.get<WidgetConfigResponse>('/api/atendimento/widget')
      setConfig(data.config)
      setDefaults(data.defaults)
      setOrgScope(data.orgScope)
      setSavedAt(data.savedAt)
    } catch (err) {
      console.error(err)
      setMessage({
        type: 'error',
        text: 'Não foi possível carregar a configuração do widget.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const snippet = useMemo(() => {
    const slug = orgScope?.slug ?? ''

    return `<script>
  window.MDSAtendimentoWidget = {
    orgSlug: '${slug}'
  };
</script>
<script defer src="https://crm.mundodigitalsolucoes.com.br/widget/loader.js"></script>`
  }, [orgScope?.slug])

  const publicPreviewUrl = useMemo(() => {
    if (!orgScope?.slug) return '—'
    return `https://crm.mundodigitalsolucoes.com.br/api/public/widget/${orgScope.slug}`
  }, [orgScope?.slug])

  const updateField = <K extends keyof WidgetConfig>(field: K, value: WidgetConfig[K]) => {
    setConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleReset = () => {
    setConfig(defaults)
    setMessage({
      type: 'info',
      text: 'Preview resetado para a configuração base desta organização.',
    })
  }

  const handleReload = async () => {
    await loadConfig()
    setMessage({
      type: 'info',
      text: 'Configuração recarregada.',
    })
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const { data } = await axios.post<{
        success: boolean
        config: WidgetConfig
        savedAt: string
        orgScope: OrgScope
      }>('/api/atendimento/widget', config)

      setConfig(data.config)
      setSavedAt(data.savedAt)
      setOrgScope(data.orgScope)

      setMessage({
        type: 'success',
        text: 'Configuração do widget salva para esta organização.',
      })
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Não foi possível salvar a configuração do widget.'
        : 'Não foi possível salvar a configuração do widget.'

      setMessage({
        type: 'error',
        text: errorText,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setMessage({
        type: 'success',
        text: 'Snippet real do widget copiado.',
      })
    } catch {
      setMessage({
        type: 'info',
        text: 'Não foi possível copiar automaticamente. Copie manualmente o bloco abaixo.',
      })
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
                <MessageCircle className="h-6 w-6 text-[#374b89]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2f3453]">
                  Widget do Atendimento
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Fase 03.1: personalização de cor por organização.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-[#374b89]" />
              Isolado do core protegido
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
              Último save: {formatDateTime(savedAt)}
            </span>
          </div>
        </div>
      </div>

      <FeedbackBanner msg={message} onClose={() => setMessage(null)} />

      {orgScope && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">Escopo da organização</h2>

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
                Rota pública
              </p>
              <p className="mt-2 break-all text-sm font-bold text-[#2f3453]">
                {publicPreviewUrl}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <Settings2 className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Configuração</h2>
                <p className="text-sm text-slate-500">
                  Ajuste, personalize cor e salve o widget.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Nome da organização
                </span>
                <input
                  value={config.organizationName}
                  onChange={(e) => updateField('organizationName', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Nome da empresa"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Título</span>
                <input
                  value={config.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Título do widget"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Subtítulo</span>
                <textarea
                  value={config.subtitle}
                  onChange={(e) => updateField('subtitle', e.target.value)}
                  className="min-h-[110px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Mensagem curta do widget"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Texto do CTA</span>
                <input
                  value={config.ctaLabel}
                  onChange={(e) => updateField('ctaLabel', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Abrir Atendimento"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Texto do botão flutuante
                </span>
                <input
                  value={config.buttonLabel}
                  onChange={(e) => updateField('buttonLabel', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Atendimento"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  URL principal do CTA
                </span>
                <input
                  value={config.primaryActionUrl}
                  onChange={(e) => updateField('primaryActionUrl', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="https://crm.mundodigitalsolucoes.com.br"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">Posição</span>
                  <select
                    value={config.position}
                    onChange={(e) =>
                      updateField('position', e.target.value as WidgetPosition)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  >
                    <option value="right">Direita</option>
                    <option value="left">Esquerda</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">Status</span>
                  <select
                    value={config.online ? 'online' : 'offline'}
                    onChange={(e) => updateField('online', e.target.value === 'online')}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">Cor principal</span>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-2">
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="h-10 w-12 rounded border-0 bg-transparent p-0"
                    />
                    <input
                      value={config.primaryColor}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="w-full text-sm outline-none"
                      placeholder="#374b89"
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">Cor de destaque</span>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-2">
                    <input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="h-10 w-12 rounded border-0 bg-transparent p-0"
                    />
                    <input
                      value={config.accentColor}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="w-full text-sm outline-none"
                      placeholder="#2f3453"
                    />
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2f3453] disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Salvar configuração
                    </>
                  )}
                </button>

                <button
                  onClick={handleReload}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Recarregar
                </button>

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Resetar preview
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Snippet real</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Este snippet já usa loader real e rota pública.
                </p>
              </div>

              <button
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2f3453]"
              >
                <Copy className="h-4 w-4" />
                Copiar
              </button>
            </div>

            <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
              <code>{snippet}</code>
            </pre>

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              O widget já pode ser carregado em site externo. Nesta fase ele distribui o contato
              e redireciona para o Atendimento via CTA.
            </div>
          </div>
        </div>

        <AtendimentoWidgetPreview
          organizationName={config.organizationName}
          title={config.title}
          subtitle={config.subtitle}
          ctaLabel={config.ctaLabel}
          online={config.online}
          position={config.position}
          buttonLabel={config.buttonLabel}
          primaryColor={config.primaryColor}
          accentColor={config.accentColor}
        />
      </div>
    </div>
  )
}