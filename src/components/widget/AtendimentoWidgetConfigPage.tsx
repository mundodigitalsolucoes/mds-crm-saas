'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Wand2,
} from 'lucide-react'

type MessageState = {
  type: 'success' | 'info' | 'error'
  text: string
} | null

type WidgetPosition = 'left' | 'right'
type PublishMode = 'all' | 'allowlist'
type DarkMode = 'light' | 'auto'
type LauncherType = 'standard' | 'expanded'

type WidgetConfig = {
  organizationName: string
  enabled: boolean
  chatwootBaseUrl: string
  websiteToken: string
  websiteInboxName: string
  websiteDomain: string
  widgetColor: string
  welcomeTitle: string
  welcomeTagline: string
  position: WidgetPosition
  locale: string
  useBrowserLanguage: boolean
  darkMode: DarkMode
  launcherType: LauncherType
  launcherTitle: string
  greetingEnabled: boolean
  greetingMessage: string
  publishMode: PublishMode
  allowedDomains: string[]
  notes: string
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

type SaveResponse = {
  success: boolean
  config: WidgetConfig
  savedAt: string
  orgScope: OrgScope
}

type ProvisionResponse = {
  success: boolean
  action: 'created' | 'updated'
  orgScope: OrgScope
  inbox: {
    chatwootInboxId: number | null
    chatwootChannelId: number | null
    websiteToken: string
    websiteUrl: string
    webWidgetScript: string
  }
  runtime: {
    provisionStatus: string
    lastSyncAt: string
  }
  savedAt: string
}

const FALLBACK_DEFAULTS: WidgetConfig = {
  organizationName: 'Mundo Digital Soluções',
  enabled: false,
  chatwootBaseUrl: 'https://app.mundodigitalsolucoes.com.br',
  websiteToken: '',
  websiteInboxName: 'Website',
  websiteDomain: 'www.exemplo.com.br',
  widgetColor: '#374b89',
  welcomeTitle: 'Fale com nosso Atendimento',
  welcomeTagline:
    'Tire dúvidas, peça suporte ou inicie seu atendimento pelo widget oficial.',
  position: 'right',
  locale: 'pt_BR',
  useBrowserLanguage: true,
  darkMode: 'auto',
  launcherType: 'expanded',
  launcherTitle: 'Atendimento',
  greetingEnabled: false,
  greetingMessage: 'Olá. Como podemos ajudar você hoje?',
  publishMode: 'all',
  allowedDomains: [],
  notes: '',
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

function parseDomains(text: string) {
  const items = text
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean)

  return Array.from(new Set(items)).slice(0, 20)
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

function StatusCard({
  title,
  value,
  ok,
}: {
  title: string
  value: string
  ok: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 text-sm',
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-yellow-200 bg-yellow-50 text-yellow-800'
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{value}</p>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#374b89] text-sm font-bold text-white">
          {number}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2f3453]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  )
}

export default function AtendimentoWidgetConfigPage() {
  const [message, setMessage] = useState<MessageState>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const [defaults, setDefaults] = useState<WidgetConfig>(FALLBACK_DEFAULTS)
  const [config, setConfig] = useState<WidgetConfig>(FALLBACK_DEFAULTS)
  const [domainText, setDomainText] = useState('')
  const [lastProvisionResult, setLastProvisionResult] = useState<ProvisionResponse | null>(null)

  const loadConfig = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await axios.get<WidgetConfigResponse>('/api/atendimento/widget')
      setConfig(data.config)
      setDefaults(data.defaults)
      setOrgScope(data.orgScope)
      setSavedAt(data.savedAt)
      setDomainText((data.config.allowedDomains || []).join('\n'))
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

  const parsedDomains = useMemo(() => parseDomains(domainText), [domainText])

  const readiness = useMemo(() => {
    const enabled = config.enabled
    const baseUrl = Boolean(config.chatwootBaseUrl.trim())
    const token = Boolean(config.websiteToken.trim())
    const domain = Boolean(config.websiteDomain.trim())
    const snippetReady = enabled && baseUrl && token
    const allowlistReady =
      config.publishMode === 'all' ? true : parsedDomains.length > 0
    const provisioned = token

    return {
      enabled,
      baseUrl,
      token,
      domain,
      allowlistReady,
      snippetReady,
      provisioned,
    }
  }, [config, parsedDomains.length])

  const snippet = useMemo(() => {
    return `<script>
  window.MDSAtendimentoWidget = {
    orgSlug: ${JSON.stringify(orgScope?.slug || '')}
  };
</script>
<script defer src="https://crm.mundodigitalsolucoes.com.br/widget/loader.js"></script>`
  }, [orgScope?.slug])

  const updateField = <K extends keyof WidgetConfig>(field: K, value: WidgetConfig[K]) => {
    setConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const saveConfig = useCallback(
    async (showSuccessMessage = true) => {
      const payload: WidgetConfig = {
        ...config,
        allowedDomains: parseDomains(domainText),
      }

      const { data } = await axios.post<SaveResponse>('/api/atendimento/widget', payload)

      setConfig(data.config)
      setSavedAt(data.savedAt)
      setOrgScope(data.orgScope)
      setDomainText((data.config.allowedDomains || []).join('\n'))

      if (showSuccessMessage) {
        setMessage({
          type: 'success',
          text: 'Configuração do widget salva para esta organização.',
        })
      }

      return data
    },
    [config, domainText]
  )

  const handleReset = () => {
    setConfig(defaults)
    setDomainText((defaults.allowedDomains || []).join('\n'))
    setMessage({
      type: 'info',
      text: 'Configuração resetada para o padrão desta organização.',
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
      await saveConfig(true)
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

  const handleProvision = async () => {
    setProvisioning(true)

    try {
      await saveConfig(false)

      const { data } = await axios.post<ProvisionResponse>(
        '/api/atendimento/widget/provision'
      )

      setLastProvisionResult(data)
      await loadConfig()

      setMessage({
        type: 'success',
        text:
          data.action === 'created'
            ? 'Widget criado no Atendimento com sucesso.'
            : 'Widget atualizado no Atendimento com sucesso.',
      })
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.message ??
          err.response?.data?.error ??
          'Não foi possível provisionar o widget.'
        : 'Não foi possível provisionar o widget.'

      setMessage({
        type: 'error',
        text: errorText,
      })
    } finally {
      setProvisioning(false)
    }
  }

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setMessage({
        type: 'success',
        text: 'Snippet do widget copiado.',
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
                  Painel SaaS do widget nativo de website do Atendimento.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-[#374b89]" />
              Alinhado à arquitetura oficial
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
                Domínio principal
              </p>
              <p className="mt-2 break-all text-sm font-bold text-[#2f3453]">
                {config.websiteDomain || '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[520px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <Settings2 className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Canal website</h2>
                <p className="text-sm text-slate-500">
                  Dados do canal nativo de website do Atendimento.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => updateField('enabled', e.target.checked)}
                />
                <div>
                  <p className="text-sm font-semibold text-[#2f3453]">Widget ativo</p>
                  <p className="text-xs text-slate-500">
                    Controla a prontidão do snippet no CRM.
                  </p>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Nome da organização
                </span>
                <input
                  value={config.organizationName}
                  onChange={(e) => updateField('organizationName', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Base URL do Atendimento
                  </span>
                  <input
                    value={config.chatwootBaseUrl}
                    onChange={(e) => updateField('chatwootBaseUrl', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                    placeholder="https://app.seudominio.com"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Website token
                  </span>
                  <input
                    value={config.websiteToken}
                    onChange={(e) => updateField('websiteToken', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                    placeholder="preenchido automaticamente após provisionar"
                    readOnly
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Nome da inbox website
                  </span>
                  <input
                    value={config.websiteInboxName}
                    onChange={(e) => updateField('websiteInboxName', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Domínio principal do site
                  </span>
                  <input
                    value={config.websiteDomain}
                    onChange={(e) => updateField('websiteDomain', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                    placeholder="www.exemplo.com.br"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#2f3453]">Visual e experiência</h2>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Cor do widget
                  </span>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-2">
                    <input
                      type="color"
                      value={config.widgetColor}
                      onChange={(e) => updateField('widgetColor', e.target.value)}
                      className="h-10 w-12 rounded border-0 bg-transparent p-0"
                    />
                    <input
                      value={config.widgetColor}
                      onChange={(e) => updateField('widgetColor', e.target.value)}
                      className="w-full text-sm outline-none"
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Posição
                  </span>
                  <select
                    value={config.position}
                    onChange={(e) => updateField('position', e.target.value as WidgetPosition)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  >
                    <option value="right">Direita</option>
                    <option value="left">Esquerda</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Idioma
                  </span>
                  <input
                    value={config.locale}
                    onChange={(e) => updateField('locale', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                    placeholder="pt_BR"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Tema
                  </span>
                  <select
                    value={config.darkMode}
                    onChange={(e) => updateField('darkMode', e.target.value as DarkMode)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  >
                    <option value="light">Claro</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={config.useBrowserLanguage}
                  onChange={(e) => updateField('useBrowserLanguage', e.target.checked)}
                />
                <div>
                  <p className="text-sm font-semibold text-[#2f3453]">
                    Usar idioma do navegador
                  </p>
                  <p className="text-xs text-slate-500">
                    Quando ativo, o widget tenta respeitar o idioma do visitante.
                  </p>
                </div>
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Tipo do launcher
                  </span>
                  <select
                    value={config.launcherType}
                    onChange={(e) =>
                      updateField('launcherType', e.target.value as LauncherType)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  >
                    <option value="standard">Standard</option>
                    <option value="expanded">Expanded</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Texto do launcher
                  </span>
                  <input
                    value={config.launcherTitle}
                    onChange={(e) => updateField('launcherTitle', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                    placeholder="Atendimento"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Welcome heading
                </span>
                <input
                  value={config.welcomeTitle}
                  onChange={(e) => updateField('welcomeTitle', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Welcome tagline
                </span>
                <textarea
                  value={config.welcomeTagline}
                  onChange={(e) => updateField('welcomeTagline', e.target.value)}
                  className="min-h-[100px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={config.greetingEnabled}
                  onChange={(e) => updateField('greetingEnabled', e.target.checked)}
                />
                <div>
                  <p className="text-sm font-semibold text-[#2f3453]">
                    Greeting da conversa
                  </p>
                  <p className="text-xs text-slate-500">
                    Campo para governança da saudação do canal website.
                  </p>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Mensagem de greeting
                </span>
                <textarea
                  value={config.greetingMessage}
                  onChange={(e) => updateField('greetingMessage', e.target.value)}
                  className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#2f3453]">Publicação</h2>

            <div className="mt-4 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Escopo de publicação
                </span>
                <select
                  value={config.publishMode}
                  onChange={(e) => updateField('publishMode', e.target.value as PublishMode)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                >
                  <option value="all">Todos os domínios</option>
                  <option value="allowlist">Somente domínios permitidos</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Allowed domains
                </span>
                <textarea
                  value={domainText}
                  onChange={(e) => setDomainText(e.target.value)}
                  className="min-h-[120px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder={'www.exemplo.com.br\napp.exemplo.com.br'}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Notas</span>
                <textarea
                  value={config.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="min-h-[90px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Observações operacionais deste widget"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving || provisioning}
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
                onClick={handleProvision}
                disabled={saving || provisioning}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {provisioning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Provisionando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    {readiness.provisioned ? 'Atualizar widget' : 'Criar widget'}
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
                Resetar
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              O botão <strong>Criar widget</strong> salva a configuração atual e depois cria
              ou atualiza a inbox website real no Atendimento.
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#2f3453]">Prontidão do widget</h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <StatusCard
                title="Widget ativo"
                value={readiness.enabled ? 'Sim' : 'Não'}
                ok={readiness.enabled}
              />
              <StatusCard
                title="Provisionamento"
                value={readiness.provisioned ? 'Provisionado' : 'Pendente'}
                ok={readiness.provisioned}
              />
              <StatusCard
                title="Website token"
                value={readiness.token ? 'Configurado' : 'Pendente'}
                ok={readiness.token}
              />
              <StatusCard
                title="Base URL"
                value={readiness.baseUrl ? 'Configurada' : 'Pendente'}
                ok={readiness.baseUrl}
              />
              <StatusCard
                title="Snippet pronto"
                value={readiness.snippetReady ? 'Sim' : 'Não'}
                ok={readiness.snippetReady}
              />
              <StatusCard
                title="Escopo de publicação"
                value={readiness.allowlistReady ? 'OK' : 'Revisar allowlist'}
                ok={readiness.allowlistReady}
              />
            </div>

            {lastProvisionResult && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">
                  Último provisionamento: {lastProvisionResult.action === 'created' ? 'criado' : 'atualizado'}
                </p>
                <p className="mt-1">
                  Inbox ID: {lastProvisionResult.inbox.chatwootInboxId ?? '—'}
                </p>
                <p className="mt-1">
                  Channel ID: {lastProvisionResult.inbox.chatwootChannelId ?? '—'}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-4 w-4 text-slate-500" />
                <div className="text-sm text-slate-600">
                  Esta tela governa o canal website nativo do Atendimento. Ela não substitui
                  a inbox do Atendimento e não cria chat paralelo.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Protocolo de ativação</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Sequência correta para ativar o widget sem desviar da arquitetura.
                </p>
              </div>

              <a
                href={config.chatwootBaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abrir Atendimento
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-4 space-y-3">
              <StepCard
                number="1"
                title="Preencher a configuração"
                description="Defina nome da inbox, domínio, visual, launcher, idioma e regras de publicação."
              />
              <StepCard
                number="2"
                title="Salvar a configuração"
                description="O CRM grava a configuração da organização antes de qualquer ação operacional."
              />
              <StepCard
                number="3"
                title="Criar widget"
                description="O CRM cria ou atualiza a inbox website real no Atendimento via backend."
              />
              <StepCard
                number="4"
                title="Copiar o snippet"
                description="Depois do provisionamento, copie o snippet governado pelo CRM."
              />
              <StepCard
                number="5"
                title="Publicar no site"
                description="Cole o snippet no site do cliente. O loader inicializa o SDK nativo do Atendimento."
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Snippet nativo</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Snippet governado pelo CRM para inicializar o widget nativo do Atendimento.
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

            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              O loader do CRM só governa a configuração pública e inicializa o SDK nativo.
              A conversa operacional continua no Atendimento.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#2f3453]">Resumo operacional</h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Canal website
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {config.websiteInboxName || '—'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Launcher
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {config.launcherType === 'expanded' ? 'Expanded' : 'Standard'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Allowed domains
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {parsedDomains.length}
                </p>
              </div>
            </div>

            {parsedDomains.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lista de domínios
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {parsedDomains.map((domain) => (
                    <span
                      key={domain}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}