'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'
import {
  AlertCircle,
  CheckCircle,
  Crown,
  Loader2,
  MessageCircle,
  Plug,
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
  Wifi,
  XCircle,
} from 'lucide-react'
import WhatsAppProviderSelectorModal from '@/components/atendimento/WhatsAppProviderSelectorModal'

type MessageState = { type: 'success' | 'error' | 'info'; text: string } | null
type InstanceStatus = 'connected' | 'connecting' | 'offline' | 'missing' | 'disconnected'

type WhatsAppInstanceItem = {
  id: string
  provider?: 'evolution' | 'whatsapp_cloud'
  label: string
  instanceName: string
  phoneNumber: string | null
  status: InstanceStatus
  isActive: boolean
  isConnected: boolean
  chatwootInboxId: number | null
  connectedAt: string | null
  disconnectedAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

type InstancesResponse = {
  plan: string
  usage: { current: number; max: number; isUnlimited: boolean; canAddMore: boolean }
  instances: WhatsAppInstanceItem[]
}

type ConnectResponse = {
  success: boolean
  instanceId: string
  instanceName: string
  label: string | null
  chatwootInboxId: number | null
}

type ReconnectResponse = ConnectResponse & { alreadyConnected: boolean }
type QRCodeData = { connected: boolean; qrcode?: string }

function formatDateTime(value: string | null) {
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

function getErrorText(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error ?? error.response?.data?.detail ?? fallback
  }
  return fallback
}

function StatusBadge({ status }: { status: InstanceStatus }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle className="h-3.5 w-3.5" /> Conectado
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
      <AlertCircle className="h-3.5 w-3.5" /> Atenção
    </span>
  )
}

function QRCodeModal({
  instanceName,
  label,
  onConnected,
  onClose,
}: {
  instanceName: string
  label: string
  onConnected: () => void
  onClose: () => void
}) {
  const [qrData, setQrData] = useState<QRCodeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef(false)

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  const fetchQr = useCallback(async () => {
    if (!activeRef.current) return

    try {
      const mode = qrData?.qrcode ? 'status' : 'qr'
      const { data } = await axios.get<QRCodeData>(
        `/api/integrations/evolution/qrcode?instance=${encodeURIComponent(instanceName)}&mode=${mode}`,
        { timeout: 15000 }
      )

      if (!activeRef.current) return

      setError(null)
      setLoading(false)

      if (data.connected) {
        clear()
        onConnected()
        return
      }

      if (data.qrcode) setQrData(data)
      timeoutRef.current = setTimeout(fetchQr, data.qrcode ? 2500 : 3500)
    } catch (err) {
      if (!activeRef.current) return
      setLoading(false)
      setError(getErrorText(err, 'Não foi possível gerar o QR Code.'))
    }
  }, [instanceName, onConnected, qrData?.qrcode])

  useEffect(() => {
    activeRef.current = true
    void fetchQr()
    return () => {
      activeRef.current = false
      clear()
    }
  }, [fetchQr])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600">
            <QrCode className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-[#2f3453]">{label}</h2>
          <p className="mt-1 text-sm text-slate-500">Escaneie o QR Code com o WhatsApp.</p>
        </div>

        <div className="mx-auto mb-5 flex h-64 w-64 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading && <Loader2 className="h-8 w-8 animate-spin text-slate-400" />}
          {!loading && error && <p className="px-4 text-center text-sm font-medium text-red-600">{error}</p>}
          {!loading && !error && qrData?.qrcode && (
            <Image src={qrData.qrcode} alt="QR Code WhatsApp" width={256} height={256} unoptimized />
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

function Feedback({ msg, onClose }: { msg: MessageState; onClose: () => void }) {
  if (!msg) return null
  const cls =
    msg.type === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : msg.type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return (
    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${cls}`}>
      <span>{msg.text}</span>
      <button onClick={onClose}>Fechar</button>
    </div>
  )
}

function WhatsAppCard({
  item,
  busy,
  onReconnect,
  onDisconnect,
  onDelete,
}: {
  item: WhatsAppInstanceItem
  busy: boolean
  onReconnect: (item: WhatsAppInstanceItem) => void
  onDisconnect: (item: WhatsAppInstanceItem) => void
  onDelete: (item: WhatsAppInstanceItem) => void
}) {
  const isCloudApi = item.provider === 'whatsapp_cloud'
  const connectedAt = formatDateTime(item.connectedAt)

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
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-700">
              {isCloudApi ? 'WhatsApp API Oficial conectado' : 'WhatsApp Business conectado'}
            </p>
            {item.phoneNumber && <p className="mt-1 text-sm text-slate-700">Número: +{item.phoneNumber}</p>}
            {connectedAt && <p className="mt-1 text-xs text-slate-500">Conectado em {connectedAt}</p>}
          </div>
        </div>
      </div>

      {isCloudApi && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Canal oficial ativo. Respostas e mensagens serão tratadas pela integração da Meta.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {isCloudApi ? (
          <button
            onClick={() => onDelete(item)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 sm:col-span-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover canal
          </button>
        ) : item.isConnected ? (
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
              onClick={() => onReconnect(item)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Reconectar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onReconnect(item)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Conectar novamente
            </button>
            <button
              onClick={() => onDelete(item)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Excluir do CRM
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AtendimentoChannelsPage() {
  const [data, setData] = useState<InstancesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null)
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null)
  const [qrLabel, setQrLabel] = useState('WhatsApp')
  const [message, setMessage] = useState<MessageState>(null)

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text })
    if (type !== 'error') setTimeout(() => setMessage(null), 5000)
  }

  const loadInstances = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axios.get<InstancesResponse>('/api/integrations/evolution/instances')
      setData(response.data)
    } catch (err) {
      showMsg('error', getErrorText(err, 'Não foi possível carregar os canais do atendimento.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInstances()
  }, [loadInstances])

  const handleOpenProviderModal = () => {
    if (!data?.usage.canAddMore) {
      showMsg('info', 'Seu plano atingiu o limite de números de WhatsApp.')
      return
    }
    setShowProviderModal(true)
  }

  const handleConnectEvolution = async () => {
    if (!data?.usage.canAddMore) return

    const labelInput = window.prompt('Nome do canal no CRM e no Atendimento:', `WA ${data.usage.current + 1}`)
    if (labelInput === null) return

    setConnectLoading(true)
    try {
      const { data: response } = await axios.post<ConnectResponse>('/api/integrations/evolution/connect', {
        label: labelInput.trim() || `WA ${data.usage.current + 1}`,
      })
      setQrInstanceId(response.instanceId)
      setQrInstanceName(response.instanceName)
      setQrLabel(response.label || labelInput)
      setShowQRModal(true)
      showMsg('info', 'Canal WhatsApp Business criado. Escaneie o QR Code para concluir.')
      await loadInstances()
    } catch (err) {
      showMsg('error', getErrorText(err, 'Erro ao iniciar conexão.'))
    } finally {
      setConnectLoading(false)
    }
  }

  const handleConnectWhatsappCloud = async () => {
    if (!data?.usage.canAddMore) return

    const label = window.prompt('Nome do canal no CRM e no Atendimento:', `WhatsApp API Oficial ${data.usage.current + 1}`)
    if (label === null) return

    const phoneNumber = window.prompt('Número do WhatsApp com DDD. Ex: 5519999999999')
    if (!phoneNumber) return

    const phoneNumberId = window.prompt('Phone Number ID da Meta:')
    if (!phoneNumberId) return

    const businessAccountId = window.prompt('WhatsApp Business Account ID:')
    if (!businessAccountId) return

    const accessToken = window.prompt('Access Token permanente da Meta:')
    if (!accessToken) return

    setConnectLoading(true)
    try {
      await axios.post('/api/atendimento/canais/whatsapp-cloud/connect', {
        label: label.trim() || `WhatsApp API Oficial ${data.usage.current + 1}`,
        phoneNumber: phoneNumber.trim(),
        phoneNumberId: phoneNumberId.trim(),
        businessAccountId: businessAccountId.trim(),
        accessToken: accessToken.trim(),
      })
      showMsg('success', 'WhatsApp API Oficial configurado com sucesso.')
      await loadInstances()
    } catch (err) {
      showMsg('error', getErrorText(err, 'Erro ao configurar WhatsApp API Oficial.'))
    } finally {
      setConnectLoading(false)
    }
  }

  const handleReconnect = async (item: WhatsAppInstanceItem) => {
    setBusyId(item.id)
    try {
      const { data: response } = await axios.post<ReconnectResponse>('/api/integrations/evolution/reconnect', {
        instanceId: item.id,
      })
      await loadInstances()
      if (response.alreadyConnected) {
        showMsg('success', `WhatsApp "${item.label}" já está conectado.`)
        return
      }
      setQrInstanceId(response.instanceId)
      setQrInstanceName(response.instanceName)
      setQrLabel(response.label || item.label)
      setShowQRModal(true)
    } catch (err) {
      showMsg('error', getErrorText(err, 'Erro ao reconectar.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDisconnect = async (item: WhatsAppInstanceItem) => {
    if (!window.confirm(`Deseja desconectar "${item.label}"?`)) return
    setBusyId(item.id)
    try {
      await axios.post('/api/integrations/evolution/disconnect', { instanceId: item.id })
      showMsg('success', `Canal "${item.label}" desconectado com sucesso.`)
      await loadInstances()
    } catch (err) {
      showMsg('error', getErrorText(err, 'Erro ao desconectar.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (item: WhatsAppInstanceItem) => {
    const isCloud = item.provider === 'whatsapp_cloud'
    const text = isCloud
      ? `Remover "${item.label}" da operação do CRM e do Atendimento? Isso não remove o número da Meta.`
      : `Deseja excluir "${item.label}" da lista do CRM?`
    if (!window.confirm(text)) return

    setBusyId(item.id)
    try {
      await axios.post(
        isCloud ? '/api/atendimento/canais/whatsapp-cloud/delete' : '/api/integrations/evolution/delete',
        { instanceId: item.id }
      )
      showMsg('success', `Canal "${item.label}" removido com sucesso.`)
      await loadInstances()
    } catch (err) {
      showMsg('error', getErrorText(err, 'Erro ao excluir canal.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleQRConnected = useCallback(async () => {
    if (!qrInstanceId) return
    try {
      await axios.post('/api/integrations/evolution/finalize', { instanceId: qrInstanceId })
      setShowQRModal(false)
      setQrInstanceId(null)
      setQrInstanceName(null)
      showMsg('success', 'WhatsApp conectado e vinculado ao Atendimento com sucesso.')
      await loadInstances()
    } catch (err) {
      showMsg('error', getErrorText(err, 'Erro ao finalizar conexão.'))
    }
  }, [loadInstances, qrInstanceId])

  const total = data?.instances.length ?? 0
  const connected = data?.instances.filter((item) => item.isConnected).length ?? 0
  const attention = data?.instances.filter((item) => !item.isConnected).length ?? 0

  return (
    <>
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
                onClick={handleOpenProviderModal}
                disabled={connectLoading || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
              >
                {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar canal
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

        <Feedback msg={message} onClose={() => setMessage(null)} />

        <button
          onClick={() => void loadInstances()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#2f3453] shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar status
        </button>

        {data?.instances.length ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {data.instances.map((item) => (
              <WhatsAppCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onReconnect={handleReconnect}
                onDisconnect={handleDisconnect}
                onDelete={handleDelete}
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

      <WhatsAppProviderSelectorModal
        open={showProviderModal}
        actionLoading={connectLoading}
        onClose={() => setShowProviderModal(false)}
        onSelectEvolution={handleConnectEvolution}
        onSelectWhatsappCloud={handleConnectWhatsappCloud}
        onShowInfo={(text) => showMsg('info', text)}
      />

      {showQRModal && qrInstanceName && (
        <QRCodeModal
          instanceName={qrInstanceName}
          label={qrLabel}
          onConnected={() => void handleQRConnected()}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </>
  )
}
