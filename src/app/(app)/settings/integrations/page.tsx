'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plug, MessageCircle, CheckCircle, XCircle,
  ExternalLink, Eye, EyeOff, Save, Loader2,
  Trash2, RefreshCw, Bot, AlertCircle, Smartphone,
  QrCode, Wifi, WifiOff, Info,
} from 'lucide-react'
import axios from 'axios'
import Image from 'next/image'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WhatsAppStatus {
  connected:    boolean
  isConnected:  boolean
  instanceName: string | null
  phone:        string | null
  lastSyncAt:   string | null
  lastError:    string | null
}

interface QRCodeData {
  connected: boolean
  qrcode?:   string
  code?:     string
  count?:    number
}

interface ChatwootStatus {
  connected:         boolean
  chatwootUrl:       string
  chatwootAccountId: number
  lastSyncAt:        string | null
  lastError:         string | null
}

interface CreateInboxResult {
  inboxCreated: boolean
  inboxName?:   string
  reason?:      string
}

type MessageState = { type: 'success' | 'error' | 'info'; text: string } | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
      ok
        ? 'bg-green-900/40 text-green-400 border border-green-800'
        : 'bg-gray-800 text-gray-400 border border-gray-700'
    }`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  )
}

function FeedbackBanner({ msg, onClose }: { msg: MessageState; onClose: () => void }) {
  if (!msg) return null

  const styles = {
    success: 'bg-green-900/30 text-green-400 border-green-800',
    error:   'bg-red-900/30 text-red-400 border-red-800',
    info:    'bg-blue-900/30 text-blue-400 border-blue-800',
  }

  const icons = {
    success: <CheckCircle className="w-4 h-4 shrink-0" />,
    error:   <AlertCircle className="w-4 h-4 shrink-0" />,
    info:    <Info className="w-4 h-4 shrink-0" />,
  }

  return (
    <div className={`mb-6 p-4 rounded-lg flex items-center justify-between gap-2 border ${styles[msg.type]}`}>
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

// ─── Modal QR Code ─────────────────────────────────────────────────────────────

function QRCodeModal({
  instanceName,
  onConnected,
  onClose,
}: {
  instanceName: string
  onConnected:  () => void
  onClose:      () => void
}) {
  const [qrData, setQrData]       = useState<QRCodeData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [expired, setExpired]     = useState(false)
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null)
  const expireTimerRef            = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQR = useCallback(async () => {
    try {
      const { data } = await axios.get<QRCodeData>(
        `/api/integrations/evolution/qrcode?instance=${instanceName}`
      )
      if (data.connected) {
        clearInterval(intervalRef.current!)
        clearTimeout(expireTimerRef.current!)
        onConnected()
        return
      }
      setQrData(data)
      setLoading(false)
      setExpired(false)
    } catch {
      setLoading(false)
    }
  }, [instanceName, onConnected])

  useEffect(() => {
    fetchQR()
    intervalRef.current    = setInterval(fetchQR, 3_000)
    expireTimerRef.current = setTimeout(() => {
      setExpired(true)
      clearInterval(intervalRef.current!)
    }, 60_000)

    return () => {
      clearInterval(intervalRef.current!)
      clearTimeout(expireTimerRef.current!)
    }
  }, [fetchQR])

  const handleRefresh = () => {
    setExpired(false)
    setLoading(true)
    fetchQR()
    intervalRef.current    = setInterval(fetchQR, 3_000)
    expireTimerRef.current = setTimeout(() => {
      setExpired(true)
      clearInterval(intervalRef.current!)
    }, 60_000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Conectar WhatsApp</h2>
          <p className="text-xs text-gray-400 mt-1">
            Escaneie o QR Code com seu WhatsApp
          </p>
        </div>

        {/* QR Code area */}
        <div className="w-56 h-56 bg-white rounded-xl flex items-center justify-center relative overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="text-xs text-gray-500">Gerando QR...</span>
            </div>
          )}

          {!loading && expired && (
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

          {!loading && !expired && qrData?.qrcode && (
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

        {/* Instruções */}
        {!expired && (
          <ol className="text-xs text-gray-400 space-y-1.5 self-start w-full">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
              Abra o WhatsApp no seu celular
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
              Toque em <strong className="text-gray-300">Menu → Aparelhos conectados</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
              Toque em <strong className="text-gray-300">Conectar um aparelho</strong> e escaneie
            </li>
          </ol>
        )}

        {/* Polling indicator */}
        {!loading && !expired && (
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IntegrationsPage() {
  // WhatsApp
  const [waStatus, setWaStatus]               = useState<WhatsAppStatus | null>(null)
  const [waLoading, setWaLoading]             = useState(true)
  const [waConnecting, setWaConnecting]       = useState(false)
  const [waDisconnecting, setWaDisconnecting] = useState(false)
  const [showQRModal, setShowQRModal]         = useState(false)
  const [qrInstance, setQrInstance]           = useState<string | null>(null)

  // Inbox creation state
  const [creatingInbox, setCreatingInbox] = useState(false)

  // Chatwoot
  const [cw, setCw]                           = useState({ chatwootUrl: '', chatwootAccountId: '', apiToken: '' })
  const [cwStatus, setCwStatus]               = useState<ChatwootStatus | null>(null)
  const [cwLoading, setCwLoading]             = useState(true)
  const [cwSaving, setCwSaving]               = useState(false)
  const [cwDisconnecting, setCwDisconnecting] = useState(false)
  const [showCwToken, setShowCwToken]         = useState(false)

  // Feedback global
  const [message, setMessage] = useState<MessageState>(null)

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text })
    if (type === 'success' || type === 'info') setTimeout(() => setMessage(null), 5000)
  }

  // ── Carregar status ─────────────────────────────────────────────────────────

  const loadWaStatus = useCallback(async () => {
    setWaLoading(true)
    try {
      const { data } = await axios.get<WhatsAppStatus>('/api/integrations/evolution/status')
      setWaStatus(data)
    } catch {
      setWaStatus(null)
    } finally {
      setWaLoading(false)
    }
  }, [])

  const loadCwStatus = useCallback(async () => {
    setCwLoading(true)
    try {
      const { data } = await axios.get<ChatwootStatus>('/api/integrations/chatwoot/status')
      setCwStatus(data)
      if (data.connected) {
        setCw(prev => ({
          ...prev,
          chatwootUrl:       data.chatwootUrl       ?? '',
          chatwootAccountId: String(data.chatwootAccountId ?? ''),
        }))
      }
    } catch {
      setCwStatus(null)
    } finally {
      setCwLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWaStatus()
    loadCwStatus()
  }, [loadWaStatus, loadCwStatus])

  // ── Criar inbox automaticamente no Chatwoot via Evolution ──────────────────

  const createChatwootInbox = useCallback(async () => {
    // Só tenta se Chatwoot estiver configurado
    if (!cwStatus?.connected) return

    setCreatingInbox(true)
    try {
      const { data } = await axios.post<CreateInboxResult>(
        '/api/integrations/whatsapp/create-inbox'
      )

      if (data.inboxCreated) {
        showMsg('success', `✅ WhatsApp conectado e inbox "${data.inboxName}" criado no Chatwoot!`)
      } else {
        // Não bloqueia — WA já conectou. Apenas avisa.
        const reasons: Record<string, string> = {
          chatwoot_not_configured:  'WhatsApp conectado! Configure o Chatwoot para criar o inbox automaticamente.',
          chatwoot_data_incomplete: 'WhatsApp conectado! Dados do Chatwoot incompletos — reconecte o Chatwoot.',
          evolution_api_error:      'WhatsApp conectado! Falha ao criar inbox no Chatwoot (erro Evolution API).',
          whatsapp_not_connected:   'WhatsApp conectado com sucesso! 🎉',
          unexpected_error:         'WhatsApp conectado! Ocorreu um erro inesperado ao criar o inbox.',
        }
        const msg = reasons[data.reason ?? ''] ?? 'WhatsApp conectado com sucesso! 🎉'
        showMsg(data.reason === 'chatwoot_not_configured' ? 'info' : 'success', msg)
      }
    } catch {
      // Falha silenciosa no inbox — WhatsApp já está conectado, não queremos assustar o usuário
      showMsg('success', 'WhatsApp conectado com sucesso! 🎉')
    } finally {
      setCreatingInbox(false)
    }
  }, [cwStatus])

  // ── WhatsApp handlers ───────────────────────────────────────────────────────

  const handleWaConnect = async () => {
    setWaConnecting(true)
    try {
      const { data } = await axios.post<{ instanceName: string; alreadyExists: boolean }>(
        '/api/integrations/evolution/connect'
      )
      setQrInstance(data.instanceName)
      setShowQRModal(true)
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao iniciar conexão.'
        : 'Erro ao iniciar conexão.'
      showMsg('error', msg)
    } finally {
      setWaConnecting(false)
    }
  }

  const handleQRConnected = useCallback(async () => {
    setShowQRModal(false)
    setQrInstance(null)
    await loadWaStatus()
    // Cria inbox no Chatwoot automaticamente via Evolution API nativa
    await createChatwootInbox()
  }, [loadWaStatus, createChatwootInbox])

  const handleWaDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp? A instância será removida.')) return
    setWaDisconnecting(true)
    try {
      await axios.post('/api/integrations/evolution/disconnect')
      showMsg('success', 'WhatsApp desconectado.')
      setWaStatus(null)
    } catch {
      showMsg('error', 'Erro ao desconectar.')
    } finally {
      setWaDisconnecting(false)
    }
  }

  // ── Chatwoot handlers ───────────────────────────────────────────────────────

  const handleCwSave = async () => {
    if (!cw.chatwootUrl || !cw.chatwootAccountId || !cw.apiToken) {
      showMsg('error', 'Preencha todos os campos do Chatwoot.')
      return
    }
    setCwSaving(true)
    try {
      await axios.post('/api/integrations/chatwoot/connect', {
        chatwootUrl:       cw.chatwootUrl,
        chatwootAccountId: Number(cw.chatwootAccountId),
        apiToken:          cw.apiToken,
      })
      showMsg('success', 'Chatwoot conectado e salvo com sucesso!')
      await loadCwStatus()
      setCw(prev => ({ ...prev, apiToken: '' }))
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao salvar.'
        : 'Erro ao salvar.'
      showMsg('error', msg)
    } finally {
      setCwSaving(false)
    }
  }

  const handleCwDisconnect = async () => {
    if (!confirm('Deseja desconectar o Chatwoot? As configurações serão removidas.')) return
    setCwDisconnecting(true)
    try {
      await axios.post('/api/integrations/chatwoot/disconnect')
      showMsg('success', 'Chatwoot desconectado.')
      setCwStatus(null)
      setCw({ chatwootUrl: '', chatwootAccountId: '', apiToken: '' })
    } catch {
      showMsg('error', 'Erro ao desconectar.')
    } finally {
      setCwDisconnecting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plug className="w-7 h-7 text-indigo-400" />
          Integrações
        </h1>
        <p className="text-gray-400 mt-1">
          Gerencie as integrações do seu CRM com serviços externos
        </p>
      </div>

      <FeedbackBanner msg={message} onClose={() => setMessage(null)} />

      {/* ── Card WhatsApp ─────────────────────────────────────────────────── */}
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
          {waLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            : <StatusBadge
                ok={waStatus?.connected === true && waStatus?.isConnected === true}
                label={
                  waStatus?.connected && waStatus?.isConnected ? 'Conectado'
                  : waStatus?.connected ? 'Salvo (offline)'
                  : 'Desconectado'
                }
              />
          }
        </div>

        <div className="p-5">

          {/* Criando inbox — feedback visual inline */}
          {creatingInbox && (
            <div className="flex items-center gap-3 p-3 bg-indigo-900/20 border border-indigo-800 rounded-xl mb-4">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
              <p className="text-xs text-indigo-300">
                Configurando inbox no Chatwoot automaticamente...
              </p>
            </div>
          )}

          {/* Estado: Conectado */}
          {waStatus?.connected && waStatus?.isConnected && (
            <div className="flex items-center gap-4 p-4 bg-green-900/20 border border-green-800 rounded-xl mb-4">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4" />
                  WhatsApp Conectado
                </p>
                {waStatus.phone && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    +{waStatus.phone}
                  </p>
                )}
                {waStatus.instanceName && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Instância: {waStatus.instanceName}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Estado: Salvo mas offline */}
          {waStatus?.connected && !waStatus?.isConnected && (
            <div className="flex items-center gap-3 p-4 bg-yellow-900/20 border border-yellow-800 rounded-xl mb-4">
              <WifiOff className="w-5 h-5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-400">WhatsApp offline</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  A instância existe mas o WhatsApp está desconectado. Clique em Reconectar.
                </p>
              </div>
            </div>
          )}

          {/* Estado: Desconectado */}
          {!waStatus?.connected && (
            <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl mb-4">
              <QrCode className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-300">WhatsApp não conectado</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Clique em Conectar para escanear o QR Code com seu celular.
                </p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3">
            {waStatus?.connected && (
              <button
                onClick={handleWaDisconnect}
                disabled={waDisconnecting || waConnecting || creatingInbox}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-900/40 text-red-400 border border-red-800 rounded-lg hover:bg-red-900/60 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {waDisconnecting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                Desconectar
              </button>
            )}
            <button
              onClick={loadWaStatus}
              disabled={waLoading || creatingInbox}
              title="Atualizar status"
              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${waLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleWaConnect}
              disabled={waConnecting || waLoading || creatingInbox}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {waConnecting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando...</>
                : creatingInbox
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Configurando Chatwoot...</>
                  : waStatus?.connected
                    ? <><QrCode className="w-4 h-4" /> Reconectar</>
                    : <><QrCode className="w-4 h-4" /> Conectar WhatsApp</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Card Chatwoot ─────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">

        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Chatwoot</h2>
              <p className="text-xs text-gray-400">Sincronize conversas e crie leads automaticamente</p>
            </div>
          </div>
          {cwLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            : <StatusBadge
                ok={cwStatus?.connected === true}
                label={cwStatus?.connected ? 'Conectado' : 'Desconectado'}
              />
          }
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">URL do Chatwoot</label>
            <input
              type="url"
              value={cw.chatwootUrl}
              onChange={e => setCw(p => ({ ...p, chatwootUrl: e.target.value }))}
              placeholder="https://seu-chatwoot.com"
              disabled={cwSaving}
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Account ID</label>
            <input
              type="number"
              value={cw.chatwootAccountId}
              onChange={e => setCw(p => ({ ...p, chatwootAccountId: e.target.value }))}
              placeholder="1"
              min={1}
              disabled={cwSaving}
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Encontre em Configurações → Integrações → API no seu Chatwoot
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              API Access Token
              {cwStatus?.connected && (
                <span className="ml-2 text-xs text-gray-500 font-normal">(deixe em branco para manter o atual)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showCwToken ? 'text' : 'password'}
                value={cw.apiToken}
                onChange={e => setCw(p => ({ ...p, apiToken: e.target.value }))}
                placeholder={cwStatus?.connected ? '••••••••' : 'Seu Access Token'}
                disabled={cwSaving}
                className="w-full px-3.5 py-2.5 pr-10 bg-gray-800 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowCwToken(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showCwToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Acesse seu perfil no Chatwoot → &quot;Access Token&quot;
            </p>
          </div>

          {cwStatus?.connected && (
            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-xs font-medium text-gray-300 mb-1">URL do Webhook</p>
              <p className="text-xs text-gray-400 font-mono break-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/chatwoot?secret=SEU_SECRET
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Configure em Configurações → Integrações → Webhooks no Chatwoot.
                Eventos: <span className="text-gray-300">conversation_created, conversation_updated, message_created, contact_created</span>
              </p>
            </div>
          )}

          <div className="pt-1">
            <a
              href="https://www.chatwoot.com/docs/product/channels/api/create-channel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Documentação do Chatwoot
            </a>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-800">
            {cwStatus?.connected && (
              <button
                onClick={handleCwDisconnect}
                disabled={cwDisconnecting || cwSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-900/40 text-red-400 border border-red-800 rounded-lg hover:bg-red-900/60 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {cwDisconnecting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                Desconectar
              </button>
            )}
            <button
              onClick={loadCwStatus}
              disabled={cwLoading || cwSaving}
              title="Atualizar status"
              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${cwLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCwSave}
              disabled={cwSaving || (!cw.chatwootUrl || !cw.chatwootAccountId || (!cw.apiToken && !cwStatus?.connected))}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {cwSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Save className="w-4 h-4" /> {cwStatus?.connected ? 'Atualizar' : 'Conectar'}</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Futuras integrações */}
      <div className="p-5 bg-gray-900 rounded-xl border-2 border-dashed border-gray-700">
        <p className="text-center text-gray-500 text-sm">
          🚀 Mais integrações em breve: Google Ads, Google Business, Email Marketing...
        </p>
      </div>

      {/* ── Modal QR Code ──────────────────────────────────────────────────── */}
      {showQRModal && qrInstance && (
        <QRCodeModal
          instanceName={qrInstance}
          onConnected={handleQRConnected}
          onClose={() => {
            setShowQRModal(false)
            setQrInstance(null)
            loadWaStatus()
          }}
        />
      )}
    </div>
  )
}
