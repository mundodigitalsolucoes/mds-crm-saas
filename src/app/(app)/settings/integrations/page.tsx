'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plug,
  MessageCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  QrCode,
  Wifi,
  WifiOff,
  Info,
  Loader2,
  Trash2,
  RefreshCw,
  Plus,
  Crown,
} from 'lucide-react'
import axios from 'axios'
import Image from 'next/image'

type MessageState = {
  type: 'success' | 'error' | 'info'
  text: string
} | null

type InstanceStatus =
  | 'connected'
  | 'connecting'
  | 'offline'
  | 'missing'
  | 'disconnected'

interface WhatsAppInstanceItem {
  id: string
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

interface InstancesResponse {
  plan: string
  usage: {
    current: number
    max: number
    isUnlimited: boolean
    canAddMore: boolean
  }
  instances: WhatsAppInstanceItem[]
}

interface ConnectResponse {
  success: boolean
  alreadyExists: boolean
  instanceId: string
  instanceName: string
  label: string | null
  chatwootInboxId: number | null
  usage?: {
    current: number
    max: number
  }
}

interface ReconnectResponse {
  success: boolean
  instanceId: string
  instanceName: string
  label: string | null
  chatwootInboxId: number | null
  alreadyConnected: boolean
}

interface QRCodeData {
  connected: boolean
  qrcode?: string
  code?: string
  count?: number
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

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
      icon: <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />,
    },
    error: {
      wrap: 'border-red-200 bg-red-50 text-red-800',
      icon: <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />,
    },
    info: {
      wrap: 'border-blue-200 bg-blue-50 text-blue-800',
      icon: <Info className="w-4 h-4 shrink-0 text-blue-600" />,
    },
  }

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 shadow-sm',
        styles[msg.type].wrap
      )}
    >
      <div className="flex items-start gap-2">
        {styles[msg.type].icon}
        <span className="text-sm leading-5">{msg.text}</span>
      </div>

      <button
        onClick={onClose}
        className="opacity-60 hover:opacity-100 transition-opacity"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  )
}

function UsageBadge({
  current,
  max,
  isUnlimited,
}: {
  current: number
  max: number
  isUnlimited: boolean
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
      <Crown className="w-3.5 h-3.5 text-[#374b89]" />
      {isUnlimited ? 'Números ilimitados' : `${current} de ${max} números em uso`}
    </div>
  )
}

function StatusBadge({ status }: { status: InstanceStatus }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle className="w-3.5 h-3.5" />
        Conectado
      </span>
    )
  }

  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Conectando
      </span>
    )
  }

  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
        <WifiOff className="w-3.5 h-3.5" />
        Offline
      </span>
    )
  }

  if (status === 'missing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        <AlertCircle className="w-3.5 h-3.5" />
        Instância ausente
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
      <XCircle className="w-3.5 h-3.5" />
      Desconectado
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
  const [expired, setExpired] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)

  const clearTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current)
  }

  const fetchQR = useCallback(async () => {
    try {
      const { data } = await axios.get<QRCodeData>(
        `/api/integrations/evolution/qrcode?instance=${instanceName}`,
        { timeout: 15000 }
      )

      attemptRef.current = 0

      if (data.connected) {
        clearTimers()
        onConnected()
        return
      }

      if (data.qrcode) {
        setQrData(data)
        setFetchError(null)
        setExpired(false)
      }

      setLoading(false)
    } catch (err) {
      attemptRef.current += 1
      console.warn(`[QR] tentativa ${attemptRef.current} falhou:`, err)

      if (attemptRef.current >= 5) {
        setFetchError('Não foi possível gerar o QR Code. Tente novamente.')
        clearTimers()
      }

      setLoading(false)
    }
  }, [instanceName, onConnected])

  const startTimers = useCallback(() => {
    intervalRef.current = setInterval(fetchQR, 3000)
    expireTimerRef.current = setTimeout(() => {
      setExpired(true)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }, 60000)
  }, [fetchQR])

  useEffect(() => {
    fetchQR()
    startTimers()

    return () => clearTimers()
  }, [fetchQR, startTimers])

  const handleRefresh = () => {
    clearTimers()
    setExpired(false)
    setFetchError(null)
    setLoading(true)
    attemptRef.current = 0
    fetchQR()
    startTimers()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-[#2f3453]">{label}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Escaneie o QR Code com o WhatsApp do número que deseja conectar
          </p>
        </div>

        <div className="mx-auto mb-5 flex h-64 w-64 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading && !fetchError && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span className="text-xs text-slate-500">Gerando QR...</span>
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm font-medium text-slate-700">{fetchError}</p>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !fetchError && expired && (
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <XCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm font-medium text-slate-700">QR Code expirado</p>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Gerar novo
              </button>
            </div>
          )}

          {!loading && !fetchError && !expired && qrData?.qrcode && (
            <Image
              src={qrData.qrcode}
              alt="QR Code WhatsApp"
              width={256}
              height={256}
              className="h-full w-full object-contain"
              unoptimized
            />
          )}
        </div>

        {!expired && !fetchError && (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
            <p className="font-semibold text-[#2f3453]">Como conectar</p>
            <p>1. Abra o WhatsApp no celular</p>
            <p>2. Vá em <strong>Aparelhos conectados</strong></p>
            <p>3. Toque em <strong>Conectar um aparelho</strong> e escaneie o QR</p>
          </div>
        )}

        {!loading && !expired && !fetchError && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Aguardando conexão...
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

function StatsRow({ data }: { data: InstancesResponse | null }) {
  const total = data?.instances.length ?? 0
  const connected = data?.instances.filter((item) => item.isConnected).length ?? 0
  const offline =
    data?.instances.filter(
      (item) =>
        item.status === 'offline' ||
        item.status === 'missing' ||
        item.status === 'connecting'
    ).length ?? 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total de números
        </p>
        <p className="mt-2 text-2xl font-bold text-[#2f3453]">{total}</p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Conectados
        </p>
        <p className="mt-2 text-2xl font-bold text-emerald-700">{connected}</p>
      </div>

      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
          Pedem atenção
        </p>
        <p className="mt-2 text-2xl font-bold text-yellow-700">{offline}</p>
      </div>
    </div>
  )
}

function WhatsAppCard({
  item,
  disconnecting,
  reconnecting,
  deleting,
  onReconnect,
  onDisconnect,
  onDelete,
}: {
  item: WhatsAppInstanceItem
  disconnecting: boolean
  reconnecting: boolean
  deleting: boolean
  onReconnect: (item: WhatsAppInstanceItem) => void
  onDisconnect: (item: WhatsAppInstanceItem) => void
  onDelete: (item: WhatsAppInstanceItem) => void
}) {
  const connectedAt = formatDateTime(item.connectedAt)
  const disconnectedAt = formatDateTime(item.disconnectedAt)
  const busy = disconnecting || reconnecting || deleting
  const canDeleteFromCrm = !item.isConnected
  const showOperationalDisconnect = item.isConnected

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-600">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-[#2f3453]">{item.label}</h3>
            <p className="truncate text-sm text-slate-500">{item.instanceName}</p>
          </div>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {item.isConnected ? (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Wifi className="w-5 h-5 text-emerald-700" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-700">WhatsApp conectado</p>
              {item.phoneNumber && (
                <p className="mt-1 text-sm text-slate-700">Número: +{item.phoneNumber}</p>
              )}
              {connectedAt && (
                <p className="mt-1 text-xs text-slate-500">Conectado em {connectedAt}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <WifiOff className="w-5 h-5 text-yellow-700" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-yellow-700">
                {item.status === 'connecting'
                  ? 'Instância iniciando'
                  : item.status === 'missing'
                    ? 'Instância não encontrada na Evolution'
                    : item.status === 'disconnected'
                      ? 'Instância desconectada'
                      : 'WhatsApp offline'}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {item.lastError ??
                  'Clique em reconectar para gerar um novo QR Code desse número.'}
              </p>

              {disconnectedAt && (
                <p className="mt-1 text-xs text-slate-500">Última queda em {disconnectedAt}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {showOperationalDisconnect ? (
          <>
            <button
              onClick={() => onDisconnect(item)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Desconectar
            </button>

            <button
              onClick={() => onReconnect(item)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {reconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
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
              {reconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              Conectar novamente
            </button>

            <button
              onClick={() => onDelete(item)}
              disabled={busy || !canDeleteFromCrm}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Excluir do CRM
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const [data, setData] = useState<InstancesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [reconnectingId, setReconnectingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null)
  const [qrLabel, setQrLabel] = useState('WhatsApp')
  const [message, setMessage] = useState<MessageState>(null)

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text })
    if (type !== 'error') {
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const loadInstances = useCallback(async () => {
    setLoading(true)

    try {
      const response = await axios.get<InstancesResponse>('/api/integrations/evolution/instances')
      setData(response.data)
    } catch (err) {
      console.error(err)
      setData(null)
      showMsg('error', 'Não foi possível carregar as instâncias do WhatsApp.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInstances()

    const interval = setInterval(() => {
      loadInstances()
    }, 15000)

    return () => clearInterval(interval)
  }, [loadInstances])

  const handleConnect = async (suggestedLabel?: string) => {
    if (!data?.usage.canAddMore) {
      showMsg('info', 'Seu plano atingiu o limite de números de WhatsApp.')
      return
    }

    const defaultLabel = suggestedLabel ?? `WhatsApp ${data.usage.current + 1}`
    const labelInput = window.prompt('Nome interno do número no CRM:', defaultLabel)

    if (labelInput === null) return

    const label = labelInput.trim() || defaultLabel

    setConnectLoading(true)

    try {
      const { data: response } = await axios.post<ConnectResponse>(
        '/api/integrations/evolution/connect',
        { label }
      )

      setQrInstanceName(response.instanceName)
      setQrLabel(response.label || label)
      setShowQRModal(true)

      showMsg('info', 'Instância criada. Escaneie o QR Code para concluir a conexão.')
      await loadInstances()
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? err.response?.data?.detail ?? 'Erro ao iniciar conexão.'
        : 'Erro ao iniciar conexão.'

      showMsg('error', errorText)
    } finally {
      setConnectLoading(false)
    }
  }

  const handleReconnect = async (item: WhatsAppInstanceItem) => {
    setReconnectingId(item.id)

    try {
      const { data: response } = await axios.post<ReconnectResponse>(
        '/api/integrations/evolution/reconnect',
        { instanceId: item.id }
      )

      await loadInstances()

      if (response.alreadyConnected) {
        showMsg('success', `WhatsApp "${item.label}" já está conectado.`)
        return
      }

      setQrInstanceName(response.instanceName)
      setQrLabel(response.label || item.label)
      setShowQRModal(true)

      showMsg('info', 'Instância preparada. Escaneie o QR Code para concluir a conexão.')
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao reconectar.'
        : 'Erro ao reconectar.'

      showMsg('error', errorText)
    } finally {
      setReconnectingId(null)
    }
  }

  const handleDisconnect = async (item: WhatsAppInstanceItem) => {
    const confirmed = window.confirm(
      `Deseja desconectar "${item.label}"? A instância será removida da Evolution.`
    )

    if (!confirmed) return

    setDisconnectingId(item.id)

    try {
      await axios.post('/api/integrations/evolution/disconnect', {
        instanceId: item.id,
      })

      showMsg('success', `WhatsApp "${item.label}" desconectado com sucesso.`)
      await loadInstances()
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao desconectar.'
        : 'Erro ao desconectar.'

      showMsg('error', errorText)
    } finally {
      setDisconnectingId(null)
    }
  }

  const handleDelete = async (item: WhatsAppInstanceItem) => {
    const confirmed = window.confirm(
      `Deseja excluir "${item.label}" da lista do CRM? Essa ação remove o canal da operação visível.`
    )

    if (!confirmed) return

    setDeletingId(item.id)

    try {
      await axios.post('/api/integrations/evolution/delete', {
        instanceId: item.id,
      })

      showMsg('success', `Canal "${item.label}" removido da lista do CRM.`)
      await loadInstances()
    } catch (err) {
      const errorText = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao excluir canal.'
        : 'Erro ao excluir canal.'

      showMsg('error', errorText)
    } finally {
      setDeletingId(null)
    }
  }

  const handleQRConnected = useCallback(async () => {
    setShowQRModal(false)
    setQrInstanceName(null)
    setQrLabel('WhatsApp')

    await new Promise((resolve) => setTimeout(resolve, 3000))
    await loadInstances()
    showMsg('success', 'WhatsApp conectado com sucesso.')
  }, [loadInstances])

  const planUsage = data?.usage

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
                <Plug className="w-6 h-6 text-[#374b89]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2f3453]">Integrações</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Gerencie os números de WhatsApp conectados ao seu CRM
                </p>
              </div>
            </div>
          </div>

          {planUsage && (
            <div className="flex flex-wrap items-center gap-3">
              <UsageBadge
                current={planUsage.current}
                max={planUsage.max}
                isUnlimited={planUsage.isUnlimited}
              />

              <button
                onClick={() => handleConnect()}
                disabled={connectLoading || loading || !planUsage.canAddMore}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
                  planUsage.canAddMore
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                )}
              >
                {connectLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Adicionar número
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <FeedbackBanner msg={message} onClose={() => setMessage(null)} />

      <StatsRow data={data} />

      {planUsage && !planUsage.canAddMore && !planUsage.isUnlimited && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-yellow-800">
            Seu plano atingiu o limite de números de WhatsApp.
          </p>
          <p className="mt-1 text-sm text-yellow-700">
            Desconecte um número atual ou faça upgrade para liberar mais instâncias.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={loadInstances}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Atualizar status
        </button>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : data?.instances?.length ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 pb-6">
          {data.instances.map((item) => (
            <WhatsAppCard
              key={item.id}
              item={item}
              disconnecting={disconnectingId === item.id}
              reconnecting={reconnectingId === item.id}
              deleting={deletingId === item.id}
              onReconnect={handleReconnect}
              onDisconnect={handleDisconnect}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <QrCode className="w-8 h-8 text-slate-500" />
            </div>

            <h2 className="mt-4 text-xl font-bold text-[#2f3453]">
              Nenhum número conectado
            </h2>

            <p className="mt-2 max-w-md text-sm text-slate-600">
              Clique em adicionar número para criar uma nova instância e escanear o QR Code
              com seu celular.
            </p>

            <button
              onClick={() => handleConnect()}
              disabled={connectLoading}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {connectLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  Conectar WhatsApp
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm">
        <p className="text-center text-sm text-slate-500">
          🚀 Mais integrações em breve: Instagram, Google Ads, Google Business, Email Marketing...
        </p>
      </div>

      {showQRModal && qrInstanceName && (
        <QRCodeModal
          instanceName={qrInstanceName}
          label={qrLabel}
          onConnected={handleQRConnected}
          onClose={() => {
            setShowQRModal(false)
            setQrInstanceName(null)
            setQrLabel('WhatsApp')
            loadInstances()
          }}
        />
      )}
    </div>
  )
}