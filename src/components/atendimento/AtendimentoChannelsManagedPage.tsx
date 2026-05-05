'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  CheckCircle,
  Crown,
  Loader2,
  MessageCircle,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  Wifi,
} from 'lucide-react'

type Provider = 'evolution' | 'whatsapp_cloud'
type Status = 'connected' | 'connecting' | 'offline' | 'missing' | 'disconnected'

type Channel = {
  id: string
  provider?: Provider
  label: string
  instanceName: string
  phoneNumber: string | null
  status: Status
  isActive: boolean
  isConnected: boolean
  chatwootInboxId: number | null
  connectedAt: string | null
  lastError: string | null
}

type ChannelsResponse = {
  usage: {
    current: number
    max: number
    isUnlimited: boolean
    canAddMore: boolean
  }
  instances: Channel[]
}

type Message = { type: 'success' | 'error' | 'info'; text: string } | null

function formatDate(value: string | null) {
  if (!value) return null
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error ?? error.response?.data?.detail ?? fallback
  }

  return fallback
}

function StatusBadge({ status }: { status: Status }) {
  const connected = status === 'connected'

  return (
    <span className={connected
      ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
      : 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600'}>
      {connected ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {connected ? 'Conectado' : 'Atenção'}
    </span>
  )
}

function Feedback({ message, onClose }: { message: Message; onClose: () => void }) {
  if (!message) return null

  const className = message.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : message.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-blue-200 bg-blue-50 text-blue-800'

  return (
    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${className}`}>
      <span>{message.text}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100">Fechar</button>
    </div>
  )
}

function ChannelCard({
  item,
  busy,
  onDelete,
  onDisconnect,
}: {
  item: Channel
  busy: boolean
  onDelete: (item: Channel) => void
  onDisconnect: (item: Channel) => void
}) {
  const isCloud = item.provider === 'whatsapp_cloud'
  const connectedAt = formatDate(item.connectedAt)

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-600">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-[#2f3453]">{item.label}</h3>
            <p className="truncate text-sm text-slate-500">{item.instanceName}</p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Wifi className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              {isCloud ? 'WhatsApp API Oficial conectado' : 'WhatsApp Business conectado'}
            </p>
            {item.phoneNumber && <p className="mt-1 text-sm text-slate-700">Número: +{item.phoneNumber}</p>}
            {connectedAt && <p className="mt-1 text-xs text-slate-500">Conectado em {connectedAt}</p>}
            {item.lastError && <p className="mt-1 text-xs text-red-600">{item.lastError}</p>}
          </div>
        </div>
      </div>

      {isCloud && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Canal oficial ativo. Respostas e mensagens serão tratadas pela integração da Meta.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {isCloud ? (
          <button
            onClick={() => onDelete(item)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 sm:col-span-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover canal
          </button>
        ) : (
          <>
            <button
              onClick={() => onDisconnect(item)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Desconectar
            </button>
            <button
              disabled
              className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
            >
              Reconectar pelo fluxo atual
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AtendimentoChannelsManagedPage() {
  const [data, setData] = useState<ChannelsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>(null)

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text })
    if (type !== 'error') setTimeout(() => setMessage(null), 5000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axios.get<ChannelsResponse>('/api/integrations/evolution/instances')
      setData(response.data)
    } catch (error) {
      showMessage('error', errorMessage(error, 'Não foi possível carregar os canais.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const addCloud = async () => {
    if (!data?.usage.canAddMore) {
      showMessage('info', 'Seu plano atingiu o limite de números de WhatsApp.')
      return
    }

    const label = window.prompt('Nome do canal:', `WhatsApp API Oficial ${data.usage.current + 1}`)
    if (label === null) return

    const phoneNumber = window.prompt('Número com DDI e DDD. Ex: 5519999999999')
    if (!phoneNumber) return

    const phoneNumberId = window.prompt('Phone Number ID da Meta:')
    if (!phoneNumberId) return

    const businessAccountId = window.prompt('WhatsApp Business Account ID:')
    if (!businessAccountId) return

    const accessToken = window.prompt('Access Token da Meta:')
    if (!accessToken) return

    setSaving('new')
    try {
      await axios.post('/api/atendimento/canais/whatsapp-cloud/connect', {
        label: label.trim() || `WhatsApp API Oficial ${data.usage.current + 1}`,
        phoneNumber: phoneNumber.trim(),
        phoneNumberId: phoneNumberId.trim(),
        businessAccountId: businessAccountId.trim(),
        accessToken: accessToken.trim(),
      })
      showMessage('success', 'WhatsApp API Oficial configurado com sucesso.')
      await load()
    } catch (error) {
      showMessage('error', errorMessage(error, 'Erro ao configurar WhatsApp API Oficial.'))
    } finally {
      setSaving(null)
    }
  }

  const deleteChannel = async (item: Channel) => {
    const isCloud = item.provider === 'whatsapp_cloud'
    const confirmed = window.confirm(
      isCloud
        ? `Remover "${item.label}" da operação do CRM e do Atendimento? Isso não remove o número da Meta.`
        : `Excluir "${item.label}" da operação visível do CRM?`
    )

    if (!confirmed) return

    setSaving(item.id)
    try {
      await axios.post(
        isCloud ? '/api/atendimento/canais/whatsapp-cloud/delete' : '/api/integrations/evolution/delete',
        { instanceId: item.id }
      )
      showMessage('success', `Canal "${item.label}" removido com sucesso.`)
      await load()
    } catch (error) {
      showMessage('error', errorMessage(error, 'Erro ao remover canal.'))
    } finally {
      setSaving(null)
    }
  }

  const disconnectChannel = async (item: Channel) => {
    const confirmed = window.confirm(`Desconectar "${item.label}"?`)
    if (!confirmed) return

    setSaving(item.id)
    try {
      await axios.post('/api/integrations/evolution/disconnect', { instanceId: item.id })
      showMessage('success', `Canal "${item.label}" desconectado com sucesso.`)
      await load()
    } catch (error) {
      showMessage('error', errorMessage(error, 'Erro ao desconectar canal.'))
    } finally {
      setSaving(null)
    }
  }

  const total = data?.instances.length ?? 0
  const connected = data?.instances.filter((item) => item.isConnected).length ?? 0
  const attention = data?.instances.filter((item) => !item.isConnected).length ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Plug className="h-7 w-7 text-[#374b89]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#2f3453]">Canais de Atendimento</h1>
              <p className="text-sm text-slate-600">Gerencie os números de WhatsApp conectados à operação do atendimento.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {data?.usage && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
                <Crown className="h-3.5 w-3.5 text-[#374b89]" />
                {data.usage.isUnlimited ? 'Números ilimitados' : `${data.usage.current} de ${data.usage.max} números em uso`}
              </div>
            )}
            <button
              onClick={addCloud}
              disabled={saving === 'new'}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
            >
              {saving === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar API Oficial
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total de números</p>
          <p className="mt-2 text-2xl font-bold text-[#2f3453]">{total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Conectados</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{connected}</p>
        </div>
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">Pedem atenção</p>
          <p className="mt-2 text-2xl font-bold text-yellow-700">{attention}</p>
        </div>
      </div>

      <Feedback message={message} onClose={() => setMessage(null)} />

      <button
        onClick={() => void load()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#2f3453] shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Atualizar status
      </button>

      {loading && !data ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando canais...
        </div>
      ) : data?.instances.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {data.instances.map((item) => (
            <ChannelCard
              key={item.id}
              item={item}
              busy={saving === item.id}
              onDelete={deleteChannel}
              onDisconnect={disconnectChannel}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 text-lg font-bold text-[#2f3453]">Nenhum canal configurado</h2>
          <p className="mt-1 text-sm text-slate-500">Adicione um canal para iniciar a operação no Atendimento.</p>
        </div>
      )}
    </div>
  )
}
