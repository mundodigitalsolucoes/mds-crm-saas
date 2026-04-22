'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  CheckCircle,
  Copy,
  Globe,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
} from 'lucide-react'

type MessageState = {
  type: 'success' | 'info' | 'error'
  text: string
} | null

type WidgetPosition = 'left' | 'right'
type PublishMode = 'all' | 'allowlist'
type DarkMode = 'light' | 'auto'
type LauncherType = 'standard' | 'expanded'
type OperatingMode = 'manual' | 'business_hours'
type FallbackBehavior = 'none' | 'redirect'
type BusinessDayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type BusinessDay = {
  enabled: boolean
  start: string
  end: string
}

type BusinessHours = Record<BusinessDayKey, BusinessDay>

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

const dayLabels: Record<BusinessDayKey, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
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

export default function AtendimentoWidgetConfigPage() {
  const [message, setMessage] = useState<MessageState>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const [defaults, setDefaults] = useState<WidgetConfig>(FALLBACK_DEFAULTS)
  const [config, setConfig] = useState<WidgetConfig>(FALLBACK_DEFAULTS)
  const [domainText, setDomainText] = useState('')

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

  const readiness = useMemo(() => {
    return {
      enabled: config.enabled,
      baseUrl: Boolean(config.chatwootBaseUrl.trim()),
      token: Boolean(config.websiteToken.trim()),
      snippetReady:
        config.enabled && Boolean(config.chatwootBaseUrl.trim()) && Boolean(config.websiteToken.trim()),
    }
  }, [config])

  const snippet = useMemo(() => {
    const baseUrl = config.chatwootBaseUrl.trim() || defaults.chatwootBaseUrl
    const websiteToken = config.websiteToken.trim()
    const type = config.launcherType === 'expanded' ? 'expanded_bubble' : 'standard'

    const settingsLines = [
      `position: ${JSON.stringify(config.position)}`,
      `locale: ${JSON.stringify(config.locale)}`,
      `useBrowserLanguage: ${config.useBrowserLanguage}`,
      `darkMode: ${JSON.stringify(config.darkMode)}`,
      `type: ${JSON.stringify(type)}`,
    ]

    if (config.launcherType === 'expanded' && config.launcherTitle.trim()) {
      settingsLines.push(`launcherTitle: ${JSON.stringify(config.launcherTitle.trim())}`)
    }

    return `<script>
  window.chatwootSettings = {
    ${settingsLines.join(',\n    ')}
  };

  (function(d, t) {
    var BASE_URL = ${JSON.stringify(baseUrl)};
    var g = d.createElement(t);
    var s = d.getElementsByTagName(t)[0];
    g.src = BASE_URL + "/packs/js/sdk.js";
    g.defer = true;
    g.async = true;
    s.parentNode.insertBefore(g, s);

    g.onload = function() {
      window.chatwootSDK.run({
        websiteToken: ${JSON.stringify(websiteToken)},
        baseUrl: BASE_URL
      });
    };
  })(document, "script");
</script>`
  }, [config, defaults.chatwootBaseUrl])

  const updateField = <K extends keyof WidgetConfig>(field: K, value: WidgetConfig[K]) => {
    setConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

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
      const payload: WidgetConfig = {
        ...config,
        allowedDomains: parseDomains(domainText),
      }

      const { data } = await axios.post<{
        success: boolean
        config: WidgetConfig
        savedAt: string
        orgScope: OrgScope
      }>('/api/atendimento/widget', payload)

      setConfig(data.config)
      setSavedAt(data.savedAt)
      setOrgScope(data.orgScope)
      setDomainText((data.config.allowedDomains || []).join('\n'))

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
                Domínio publicado
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
                    placeholder="token da inbox website"
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
                    placeholder="Website"
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
                Resetar
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#2f3453]">Prontidão do widget</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  Base URL
                </p>
                <p className="mt-2 break-all text-sm font-bold text-[#2f3453]">
                  {config.chatwootBaseUrl || '—'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div
                className={cn(
                  'rounded-2xl border p-4 text-sm',
                  readiness.enabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-yellow-200 bg-yellow-50 text-yellow-800'
                )}
              >
                <p className="font-semibold">Widget ativo</p>
                <p className="mt-1">{readiness.enabled ? 'Sim' : 'Não'}</p>
              </div>

              <div
                className={cn(
                  'rounded-2xl border p-4 text-sm',
                  readiness.token
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-yellow-200 bg-yellow-50 text-yellow-800'
                )}
              >
                <p className="font-semibold">Website token</p>
                <p className="mt-1">{readiness.token ? 'Configurado' : 'Pendente'}</p>
              </div>

              <div
                className={cn(
                  'rounded-2xl border p-4 text-sm',
                  readiness.baseUrl
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-yellow-200 bg-yellow-50 text-yellow-800'
                )}
              >
                <p className="font-semibold">Base URL</p>
                <p className="mt-1">{readiness.baseUrl ? 'Configurada' : 'Pendente'}</p>
              </div>

              <div
                className={cn(
                  'rounded-2xl border p-4 text-sm',
                  readiness.snippetReady
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-yellow-200 bg-yellow-50 text-yellow-800'
                )}
              >
                <p className="font-semibold">Snippet pronto</p>
                <p className="mt-1">{readiness.snippetReady ? 'Sim' : 'Não'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-4 w-4 text-slate-500" />
                <div className="text-sm text-slate-600">
                  Esta tela governa o canal website nativo do Atendimento. Ela não substitui a
                  inbox do Atendimento e não cria chat paralelo.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Snippet nativo</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Snippet baseado em `websiteToken`, `baseUrl` e `chatwootSettings`.
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
              Campos como cor, heading, tagline e greeting fazem parte da governança do canal
              website. O snippet acima já usa a base nativa do Atendimento.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#2f3453]">Prévia de configuração</h2>

            <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)] p-6">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Website inbox
                </p>
                <h3 className="mt-2 text-xl font-bold text-[#2f3453]">
                  {config.websiteInboxName || config.organizationName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {config.websiteDomain || 'www.exemplo.com.br'}
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-[340px] rounded-3xl border border-slate-200 bg-white shadow-xl">
                  <div
                    className="rounded-t-3xl px-5 py-4 text-white"
                    style={{ backgroundColor: config.widgetColor }}
                  >
                    <p className="text-sm font-semibold">{config.welcomeTitle}</p>
                    <p className="mt-1 text-xs text-slate-100">{config.welcomeTagline}</p>
                  </div>

                  <div className="space-y-4 px-5 py-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                      Launcher: {config.launcherType === 'expanded' ? 'Expanded bubble' : 'Standard'}
                    </div>

                    {config.greetingEnabled && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                        Greeting: {config.greetingMessage}
                      </div>
                    )}

                    <button
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: config.widgetColor }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {config.launcherType === 'expanded'
                        ? config.launcherTitle || 'Atendimento'
                        : 'Abrir chat'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Publish mode
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {config.publishMode === 'all' ? 'Todos os domínios' : 'Allowlist'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Idioma
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {config.useBrowserLanguage ? `${config.locale} + navegador` : config.locale}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Allowed domains
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {parseDomains(domainText).length}
                </p>
              </div>
            </div>

            {parseDomains(domainText).length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lista de domínios
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {parseDomains(domainText).map((domain) => (
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