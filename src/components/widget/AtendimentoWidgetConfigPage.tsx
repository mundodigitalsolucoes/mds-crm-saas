'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle,
  Copy,
  Info,
  MessageCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import AtendimentoWidgetPreview from '@/components/widget/AtendimentoWidgetPreview'

type MessageState = {
  type: 'success' | 'info'
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

  const isSuccess = msg.type === 'success'

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-blue-200 bg-blue-50 text-blue-800'
      )}
    >
      <div className="flex items-start gap-2">
        {isSuccess ? (
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
        )}
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

const DEFAULT_CONFIG: WidgetConfig = {
  organizationName: 'Mundo Digital Soluções',
  title: 'Fale com nosso Atendimento',
  subtitle:
    'Tire dúvidas, peça suporte ou inicie seu atendimento comercial por este canal.',
  ctaLabel: 'Abrir Atendimento',
  online: true,
  position: 'right',
  buttonLabel: 'Atendimento',
  primaryActionUrl: 'https://app.mundodigitalsolucoes.com.br',
}

export default function AtendimentoWidgetConfigPage() {
  const [message, setMessage] = useState<MessageState>(null)
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG)

  const snippet = useMemo(() => {
    const escapedTitle = config.title.replace(/'/g, "\\'")
    const escapedSubtitle = config.subtitle.replace(/'/g, "\\'")
    const escapedButtonLabel = config.buttonLabel.replace(/'/g, "\\'")
    const escapedOrganization = config.organizationName.replace(/'/g, "\\'")
    const escapedCta = config.ctaLabel.replace(/'/g, "\\'")
    const escapedUrl = config.primaryActionUrl.replace(/'/g, "\\'")

    return `<script>
  window.MDSAtendimentoWidgetConfig = {
    organizationName: '${escapedOrganization}',
    title: '${escapedTitle}',
    subtitle: '${escapedSubtitle}',
    ctaLabel: '${escapedCta}',
    buttonLabel: '${escapedButtonLabel}',
    position: '${config.position}',
    online: ${config.online},
    primaryActionUrl: '${escapedUrl}'
  };
</script>
<script defer src="https://crm.mundodigitalsolucoes.com.br/widget/loader.js"></script>`
  }, [config])

  const updateField = <K extends keyof WidgetConfig>(field: K, value: WidgetConfig[K]) => {
    setConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG)
    setMessage({
      type: 'info',
      text: 'Configuração resetada para o padrão da Fase Widget 01.',
    })
  }

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setMessage({
        type: 'success',
        text: 'Snippet copiado.',
      })
    } catch {
      setMessage({
        type: 'info',
        text: 'Não foi possível copiar automaticamente. Copie manualmente o bloco abaixo.',
      })
    }
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
                  Fase 01: casca visual, preview e snippet conceitual, sem tocar no motor do
                  Atendimento.
                </p>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-[#374b89]" />
            Isolado do core protegido
          </span>
        </div>
      </div>

      <FeedbackBanner msg={message} onClose={() => setMessage(null)} />

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
                  Ajuste o comportamento visual do widget.
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
                  placeholder="https://app.mundodigitalsolucoes.com.br"
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

              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Resetar preview
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Snippet conceitual</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ainda não existe loader real nesta fase.
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

            <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              Este snippet serve para validar UX, texto e distribuição. A publicação real do
              widget entra só na próxima fase.
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
        />
      </div>
    </div>
  )
}