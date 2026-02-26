/**
 * src/components/integrations/WhatsAppStatusBanner.tsx
 *
 * Banner de notificação visual quando o WhatsApp desconecta.
 * Deve ser incluído na página de Integrações ou no layout global do app.
 *
 * Comportamento:
 * - Polling a cada 30s verificando /api/integrations/evolution/status
 * - Mostra banner vermelho quando isConnected=false e connected=true
 *   (ou seja: conta existe mas WA caiu — celular sem internet, etc.)
 * - Mostra banner verde por 5s quando reconecta automaticamente
 * - Desaparece se o usuário desconectar manualmente (connected=false)
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { WifiOff, Wifi, X, RefreshCw } from 'lucide-react'

interface WAStatus {
  connected:      boolean   // tem conta WA configurada?
  isConnected?:   boolean   // celular online?
  disconnectedAt?: string | null
  lostConnection?: boolean
}

interface Props {
  /** Intervalo de polling em ms. Default: 30.000 (30s) */
  pollInterval?: number
  /** Callback quando status muda — útil para atualizar UI pai */
  onStatusChange?: (status: WAStatus) => void
}

export default function WhatsAppStatusBanner({
  pollInterval = 30_000,
  onStatusChange,
}: Props) {
  const [status,        setStatus]        = useState<WAStatus | null>(null)
  const [dismissed,     setDismissed]     = useState(false)
  const [reconnected,   setReconnected]   = useState(false)
  const [reconnecting,  setReconnecting]  = useState(false)
  const prevConnected = useRef<boolean | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/integrations/evolution/status')
      const data = await res.json() as WAStatus

      setStatus(data)
      onStatusChange?.(data)

      // Detecta reconexão automática (estava offline, voltou)
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
      // Silencioso — não queremos erros de rede quebrando a UI
    }
  }, [onStatusChange])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, pollInterval)
    return () => clearInterval(interval)
  }, [checkStatus, pollInterval])

  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      await fetch('/api/integrations/evolution/connect', { method: 'POST' })
      await checkStatus()
    } finally {
      setReconnecting(false)
    }
  }

  // Não renderiza nada se: sem conta WA, ou user dismissou, ou estado desconhecido
  if (!status?.connected || dismissed) return null

  // Banner de reconexão bem-sucedida (verde, some em 5s)
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

  // Banner de desconexão (vermelho)
  if (status.connected && status.isConnected === false) {
    const since = status.disconnectedAt
      ? new Date(status.disconnectedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null

    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg max-w-sm">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">WhatsApp desconectado</p>
            <p className="text-xs text-red-200 mt-0.5">
              {since ? `Desde ${since} — ` : ''}
              Verifique o celular ou reconecte.
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleReconnect}
              disabled={reconnecting}
              title="Tentar reconectar"
              className="p-1 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${reconnecting ? 'animate-spin' : ''}`} />
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
