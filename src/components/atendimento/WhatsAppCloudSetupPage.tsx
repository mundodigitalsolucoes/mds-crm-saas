'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

type MessageState = {
  type: 'success' | 'error' | 'info'
  text: string
} | null

type OrgScope = {
  id: string
  name: string
  slug: string
  plan: string
}

type CloudStatus = 'disconnected' | 'configured' | 'pending_validation'

type CloudStatusResponse = {
  provider: 'whatsapp_cloud'
  status: CloudStatus
  configured: boolean
  orgScope: OrgScope
  setup: {
    connectedAccountId: string
    displayName: string
    appId: string
    businessAccountId: string
    phoneNumberId: string
    verifyToken: string
    hasAccessToken: boolean
    lastError: string | null
    lastSyncAt: string | null
    updatedAt: string
  } | null
}

type FormState = {
  displayName: string
  appId: string
  businessAccountId: string
  phoneNumberId: string
  verifyToken: string
  accessToken: string
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

function StatusBadge({ status }: { status: CloudStatus }) {
  if (status === 'configured') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        Configurado
      </span>
    )
  }

  if (status === 'pending_validation') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
        <Info className="h-3.5 w-3.5" />
        Pendente de validação
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
      <Plug className="h-3.5 w-3.5" />
      Desconectado
    </span>
  )
}

const EMPTY_FORM: FormState = {
  displayName: '',
  appId: '',
  businessAccountId: '',
  phoneNumberId: '',
  verifyToken: '',
  accessToken: '',
}

export default function WhatsAppCloudSetupPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)
  const [statusData, setStatusData] = useState<CloudStatusResponse | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const loadStatus = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await axios.get<CloudStatusResponse>(
        '/api/integrations/whatsapp-cloud/status'
      )

      setStatusData(data)

      setForm({
        displayName: data.setup?.displayName ?? '',
        appId: data.setup?.appId ?? '',
        businessAccountId: data.setup?.businessAccountId ?? '',
        phoneNumberId: data.setup?.phoneNumberId ?? '',
        verifyToken: data.setup?.verifyToken ?? '',
        accessToken: '',
      })
    } catch (err) {
      console.error(err)
      setStatusData(null)
      setMessage({
        type: 'error',
        text: 'Não foi possível carregar o status do WhatsApp Cloud API.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const canSave = useMemo(() => {
    return (
      form.displayName.trim() &&
      form.appId.trim() &&
      form.businessAccountId.trim() &&
      form.phoneNumberId.trim() &&
      form.verifyToken.trim()
    )
  }, [form])

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    if (!canSave) {
      setMessage({
        type: 'info',
        text: 'Preencha os campos obrigatórios antes de salvar.',
      })
      return
    }

    setSaving(true)

    try {
      await axios.post('/api/integrations/whatsapp-cloud/setup', form)

      setMessage({
        type: 'success',
        text: 'Configuração do WhatsApp Cloud API salva com sucesso para esta organização.',
      })

      await loadStatus()
      setForm((current) => ({
        ...current,
        accessToken: '',
      }))
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao salvar configuração do WhatsApp Cloud API.'
        : 'Erro ao salvar configuração do WhatsApp Cloud API.'

      setMessage({
        type: 'error',
        text: errorText,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    const confirmed = window.confirm(
      'Deseja remover a configuração do WhatsApp Cloud API desta organização?'
    )

    if (!confirmed) return

    setRemoving(true)

    try {
      await axios.delete('/api/integrations/whatsapp-cloud/setup')

      setMessage({
        type: 'success',
        text: 'Configuração do WhatsApp Cloud API removida desta organização.',
      })

      await loadStatus()
      setForm(EMPTY_FORM)
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao remover configuração do WhatsApp Cloud API.'
        : 'Erro ao remover configuração do WhatsApp Cloud API.'

      setMessage({
        type: 'error',
        text: errorText,
      })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
                <Plug className="h-6 w-6 text-[#374b89]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2f3453]">WhatsApp Cloud API</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Setup inicial isolado da trilha atual de Conexão com WA.
                </p>
              </div>
            </div>
          </div>

          {statusData && <StatusBadge status={statusData.status} />}
        </div>
      </div>

      <FeedbackBanner msg={message} onClose={() => setMessage(null)} />

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {statusData?.orgScope && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-[#2f3453]">Escopo da organização</h2>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Organização
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#2f3453]">
                    {statusData.orgScope.name}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Slug
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#2f3453]">
                    {statusData.orgScope.slug}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Plano
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#2f3453]">
                    {statusData.orgScope.plan}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#2f3453]">Setup manual da API oficial</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Esta etapa só salva a configuração por organização. Ainda não cria canal no Atendimento.
                </p>
              </div>

              <button
                onClick={() => void loadStatus()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Nome amigável</span>
                <input
                  value={form.displayName}
                  onChange={(e) => updateField('displayName', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Ex.: WhatsApp Cloud Principal"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Meta App ID</span>
                <input
                  value={form.appId}
                  onChange={(e) => updateField('appId', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Informe o App ID"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Business Account ID</span>
                <input
                  value={form.businessAccountId}
                  onChange={(e) => updateField('businessAccountId', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Informe o WABA ID"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Phone Number ID</span>
                <input
                  value={form.phoneNumberId}
                  onChange={(e) => updateField('phoneNumberId', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Informe o Phone Number ID"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">Verify Token</span>
                <input
                  value={form.verifyToken}
                  onChange={(e) => updateField('verifyToken', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Defina um verify token"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Access Token
                </span>
                <input
                  value={form.accessToken}
                  onChange={(e) => updateField('accessToken', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Obrigatório no primeiro save"
                  type="password"
                />
                <p className="text-xs text-slate-500">
                  Depois do primeiro save, só preencha se quiser trocar o token atual.
                </p>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2f3453] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Salvar configuração
                  </>
                )}
              </button>

              <button
                onClick={handleRemove}
                disabled={removing || statusData?.status === 'disconnected'}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {removing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  'Remover configuração'
                )}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#2f3453]">Estado atual</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {statusData?.status ?? '—'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Última sincronização
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {formatDateTime(statusData?.setup?.lastSyncAt ?? null)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Última atualização
                </p>
                <p className="mt-2 text-sm font-bold text-[#2f3453]">
                  {formatDateTime(statusData?.setup?.updatedAt ?? null)}
                </p>
              </div>
            </div>

            {statusData?.setup?.lastError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">Último erro</p>
                <p className="mt-1 text-sm text-red-700">{statusData.setup.lastError}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}