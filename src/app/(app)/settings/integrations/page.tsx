'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plug,
  MessageCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Smartphone,
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

interface QRCodeData {
  connected: boolean
  qrcode?: string
  code?: string
  count?: number
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
    success: 'bg-green-900/30 text-green-400 border-green-800',
    error: 'bg-red-900/30 text-red-400 border-red-800',
    info: 'bg-blue-900/30 text-blue-400 border-blue-800',
  }

  const icons = {
    success: <CheckCircle className="w-4 h-4 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 shrink-0" />,
    info: <Info className="w-4 h-4 shrink-0" />,
  }

  return (
    <div
      className={`mb-6 p-4 rounded-lg flex items-center justify-between gap-2 border ${styles[msg.type]}`}
    >
      <div className="flex items-center gap-2">
        {icons[msg.type]}
        <span className="text-sm">{msg.text}</span>
      </div>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100">
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
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-800 bg-indigo-900/20 text-indigo-300 text-xs font-medium">
      <Crown className="w-3.5 h-3.5" />
      {isUnlimited ? 'Números ilimitados' : `${current} de ${max} números em uso`}
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: InstanceStatus
}) {
  const map: Record<
    InstanceStatus,
    {
      label: string
      className: string
      icon: React.ReactNode
    }
  > = {
    connected: {
      label: 'Conectado',
      className: 'bg-green-900/40 text-green-400 border border-green-800',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    connecting: {
      label: 'Conectando',
      className: 'bg-blue-900/40 text-blue-400 border border-blue-800',
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    },
    offline: {
      label: 'Offline',
      className: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
      icon: <WifiOff className="w-3.5 h-3.5" />,
    },
    missing: {
      label: 'Instância ausente',
      className: 'bg-red-900/40 text-red-400 border border-red-800',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    disconnected: {
      label: 'Desconectado',
      className: 'bg-gray-800 text-gray-400 border border-gray-700',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  }

  const config = map[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
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
        { timeout: 15_000 }
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
    intervalRef.current = setInterval(fetchQR, 3_000)
    expireTimerRef.current = setTimeout(() => {
      setExpired(true)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }, 60_000)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-5">
        <div className="text-center">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">{label}</h2>
          <p className="text-xs text-gray-400 mt-1">Escaneie o QR Code com seu WhatsApp</p>
        </div>

        <div className="w-56 h-56 bg-white rounded-xl flex items-center justify-center relative overflow-hidden">
          {loading && !fetchError && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="text-xs text-gray-500">Gerando QR...</span>
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-gray-600 font-medium">{fetchError}</p>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !fetchError && expired && (
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <XCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-gray-600 font-medium">QR Code expirado</p>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
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
              width={224}
              height={224}
              className="w-full h-full object-contain"
              unoptimized
            />
          )}
        </div>

        {!expired && !fetchError && (
          <ol className="text-xs text-gray-400 space-y-1.5 self-start w-full">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              Abra o WhatsApp no seu celular
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              Toque em <strong className="text-gray-300">Menu → Aparelhos conectados</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              Toque em <strong className="text-gray-300">Conectar um aparelho</strong> e escaneie
            </li>
          </ol>
        )}

        {!loading && !expired && !fetchError && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Aguardando conexão...
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 text-sm transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

function WhatsAppCard({
  item,
  busy,
  onReconnect,
  onDisconnect,
}: {
  item: WhatsAppInstanceItem
  busy: boolean
  onReconnect: (item: WhatsAppInstanceItem) => void
  onDisconnect: (item: WhatsAppInstanceItem) => void
}) {
  const connectedAt = formatDateTime(item.connectedAt)
  const disconnectedAt = formatDateTime(item.disconnectedAt)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-gray-800 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white truncate">{item.label}</h3>
            <p className="text-xs text-gray-400 truncate">{item.instanceName}</p>
          </div>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <div className="p-5 space-y-4">
        {item.isConnected ? (
          <div className="flex items-center gap-4 p-4 bg-green-900/20 border border-green-800 rounded-xl">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
                <Wifi className="w-4 h-4" />
                WhatsApp conectado
              </p>
              {item.phoneNumber && (
                <p className="text-xs text-gray-400 mt-0.5">+{item.phoneNumber}</p>
              )}
              {connectedAt && (
                <p className="text-[11px] text-gray-500 mt-1">Conectado em {connectedAt}</p>
              )}
            </div>
          </div>
        ) : item.status === 'offline' || item.status === 'connecting' || item.status === 'missing' ? (
          <div className="flex items-center gap-3 p-4 bg-yellow-900/20 border border-yellow-800 rounded-xl">
            <WifiOff className="w-5 h-5 text-yellow-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-yellow-400">
                {item.status === 'connecting'
                  ? 'Instância iniciando'
                  : item.status === 'missing'
                    ? 'Instância não encontrada na Evolution'
                    : 'WhatsApp offline'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {item.lastError ??
                  'Clique em reconectar para gerar um novo QR Code para este número.'}
              </p>
              {disconnectedAt && (
                <p className="text-[11px] text-gray-500 mt-1">Última queda em {disconnectedAt}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
            <QrCode className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-300">Instância desconectada</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Você pode criar uma nova conexão usando este mesmo rótulo.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {item.isActive && (
            <button
              onClick={() => onDisconnect(item)}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-900/40 text-red-400 border border-red-800 rounded-lg hover:bg-red-900/60 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Desconectar
            </button>
          )}

          <button
            onClick={() => onReconnect(item)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            <QrCode className="w-4 h-4" />
            {item.isActive ? 'Reconectar' : 'Conectar novamente'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const [data, setData] = useState<InstancesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null)
  const [qrLabel, setQrLabel] = useState<string>('WhatsApp')
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
    if (item.isActive) {
      setQrInstanceName(item.instanceName)
      setQrLabel(item.label)
      setShowQRModal(true)
      return
    }

    await handleConnect(item.label)
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plug className="w-7 h-7 text-indigo-400" />
            Integrações
          </h1>
          <p className="text-gray-400 mt-1">
            Gerencie as integrações do seu CRM com serviços externos
          </p>
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
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

      <FeedbackBanner msg={message} onClose={() => setMessage(null)} />

      {planUsage && !planUsage.canAddMore && !planUsage.isUnlimited && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-800 bg-yellow-900/20 text-yellow-300">
          <p className="text-sm font-medium">
            Seu plano atingiu o limite de números de WhatsApp.
          </p>
          <p className="text-xs text-yellow-200/80 mt-1">
            Desconecte um número atual ou faça upgrade para liberar mais instâncias.
          </p>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={loadInstances}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar status
        </button>
      </div>

      {loading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : data?.instances?.length ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {data.instances.map((item) => (
            <WhatsAppCard
              key={item.id}
              item={item}
              busy={connectLoading || disconnectingId === item.id}
              onReconnect={handleReconnect}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">WhatsApp</h2>
                <p className="text-xs text-gray-400">Conecte seu WhatsApp via QR Code</p>
              </div>
            </div>
            <StatusBadge status="disconnected" />
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl mb-4">
              <QrCode className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-300">Nenhum número conectado</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Clique em adicionar número para escanear o QR Code com seu celular.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleConnect()}
              disabled={connectLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
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

      <div className="mt-6 p-5 bg-gray-900 rounded-xl border-2 border-dashed border-gray-700">
        <p className="text-center text-gray-500 text-sm">
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