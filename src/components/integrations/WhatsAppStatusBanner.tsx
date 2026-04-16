/**
 * src/components/integrations/WhatsAppStatusBanner.tsx
 *
 * Banner global de status do WhatsApp.
 * Não deve criar canal novo nem tentar reconectar via /connect.
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { WifiOff, Wifi, X, RefreshCw } from 'lucide-react'

interface WAStatus {
  connected: boolean
  isConnected?: boolean
  disconnectedAt?: string | null
  lostConnection?: boolean
  unstable?: boolean
  label?: string | null
}

interface Props {
  pollInterval?: number
  onStatusChange?: (status: WAStatus) => void
}

export default function WhatsAppStatusBanner({
  pollInterval = 180_000,
  onStatusChange,
}: Props) {
  const [status, setStatus] = useState<WAStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [reconnected, setReconnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const prevConnected = useRef<boolean | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/evolution/status')
      const data = await res.json() as WAStatus

      setStatus(data)
      onStatusChange?.(data)

      if (
        prevConnected.current === false &&
        data.connected &&
        data.isConnected
      ) {
        setReconnected(true)
        setDismissed(false)
        setTimeout(() => setReconnected(false), 5_000)
      }

      prevConnected.current = data.isConnected ?? null
    } catch {
      // silencioso
    }
  }, [onStatusChange])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, pollInterval)
    return () => clearInterval(interval)
  }, [checkStatus, pollInterval])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await checkStatus()
    } finally {
      setRefreshing(false)
    }
  }

  if (!status?.connected || dismissed) return null

  if (reconnected) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg">
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">WhatsApp reconectado com sucesso!</span>
          <button onClick={() => setReconnected(false)} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (status.connected && status.isConnected === false) {
    const since = status.disconnectedAt
      ? new Date(status.disconnectedAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg max-w-sm">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">WhatsApp desconectado</p>
            <p className="text-xs text-red-200 mt-0.5">
              {since ? `Desde ${since} — ` : ''}
              Verifique o celular ou reconecte pela tela de Integrações.
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Atualizar status"
              className="p-1 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setDismissed(true)}
              title="Fechar"
              className="p-1 hover:bg-red-500 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}