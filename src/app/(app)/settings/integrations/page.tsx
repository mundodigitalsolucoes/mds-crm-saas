// src/app/(app)/settings/integrations/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plug, MessageCircle, CheckCircle, XCircle,
  ExternalLink, Eye, EyeOff, Save, Loader2,
  Trash2, RefreshCw, Bot, AlertCircle,
} from 'lucide-react'
import axios from 'axios'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WhatsAppStatus {
  connected:    boolean
  isConnected:  boolean
  serverUrl:    string
  instanceName: string
  lastSyncAt:   string | null
  lastError:    string | null
}

interface ChatwootStatus {
  connected:         boolean
  chatwootUrl:       string
  chatwootAccountId: number
  lastSyncAt:        string | null
  lastError:         string | null
}

type MessageState = { type: 'success' | 'error'; text: string } | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
      ok
        ? 'bg-green-900/40 text-green-400 border border-green-800'
        : 'bg-gray-800 text-gray-400 border border-gray-700'
    }`}>
      {ok
        ? <CheckCircle className="w-3.5 h-3.5" />
        : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  )
}

function FeedbackBanner({ msg, onClose }: { msg: MessageState; onClose: () => void }) {
  if (!msg) return null
  return (
    <div className={`mb-6 p-4 rounded-lg flex items-center justify-between gap-2 border ${
      msg.type === 'success'
        ? 'bg-green-900/30 text-green-400 border-green-800'
        : 'bg-red-900/30 text-red-400 border-red-800'
    }`}>
      <div className="flex items-center gap-2">
        {msg.type === 'success'
          ? <CheckCircle className="w-4 h-4 shrink-0" />
          : <AlertCircle className="w-4 h-4 shrink-0" />}
        <span className="text-sm">{msg.text}</span>
      </div>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IntegrationsPage() {
  // WhatsApp
  const [wa, setWa] = useState({ serverUrl: '', instanceName: '', apiKey: '' })
  const [waStatus, setWaStatus]     = useState<WhatsAppStatus | null>(null)
  const [waLoading, setWaLoading]   = useState(true)
  const [waSaving, setWaSaving]     = useState(false)
  const [waDisconnecting, setWaDisconnecting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // Chatwoot
  const [cw, setCw] = useState({ chatwootUrl: '', chatwootAccountId: '', apiToken: '' })
  const [cwStatus, setCwStatus]     = useState<ChatwootStatus | null>(null)
  const [cwLoading, setCwLoading]   = useState(true)
  const [cwSaving, setCwSaving]     = useState(false)
  const [cwDisconnecting, setCwDisconnecting] = useState(false)
  const [showCwToken, setShowCwToken] = useState(false)

  // Feedback global
  const [message, setMessage] = useState<MessageState>(null)

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    if (type === 'success') setTimeout(() => setMessage(null), 4000)
  }

  // ── Carregar status ─────────────────────────────────────────────────────────

  const loadWaStatus = useCallback(async () => {
    setWaLoading(true)
    try {
      const { data } = await axios.get<WhatsAppStatus>('/api/integrations/whatsapp/status')
      setWaStatus(data)
      if (data.connected) {
        setWa(prev => ({
          ...prev,
          serverUrl:    data.serverUrl    ?? '',
          instanceName: data.instanceName ?? '',
        }))
      }
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

  // ── WhatsApp handlers ───────────────────────────────────────────────────────

  const handleWaSave = async () => {
    if (!wa.serverUrl || !wa.instanceName || !wa.apiKey) {
      showMsg('error', 'Preencha todos os campos do WhatsApp.')
      return
    }
    setWaSaving(true)
    try {
      await axios.post('/api/integrations/whatsapp/connect', wa)
      showMsg('success', 'WhatsApp conectado e salvo com sucesso!')
      await loadWaStatus()
      setWa(prev => ({ ...prev, apiKey: '' })) // limpar campo sensível
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error ?? 'Erro ao salvar.'
        : 'Erro ao salvar.'
      showMsg('error', msg)
    } finally {
      setWaSaving(false)
    }
  }

  const handleWaDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp? As configurações serão removidas.')) return
    setWaDisconnecting(true)
    try {
      await axios.post('/api/integrations/whatsapp/disconnect')
      showMsg('success', 'WhatsApp desconectado.')
      setWaStatus(null)
      setWa({ serverUrl: '', instanceName: '', apiKey: '' })
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
      setCw(prev => ({ ...prev, apiToken: '' })) // limpar campo sensível
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

        {/* Header do card */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">WhatsApp — Evolution API</h2>
              <p className="text-xs text-gray-400">Envie mensagens automáticas para seus leads</p>
            </div>
          </div>
          {waLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            : <StatusBadge
                ok={waStatus?.connected === true && waStatus?.isConnected === true}
                label={
                  waStatus?.connected && waStatus?.isConnected
                    ? 'Conectado'
                    : waStatus?.connected
                      ? 'Salvo (offline)'
                      : 'Desconectado'
                }
              />
          }
        </div>

        {/* Formulário */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              URL do Servidor
            </label>
            <input
              type="url"
              value={wa.serverUrl}
              onChange={e => setWa(p => ({ ...p, serverUrl: e.target.value }))}
              placeholder="https://sua-evolution-api.com"
              disabled={waSaving}
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Nome da Instância
            </label>
            <input
              type="text"
              value={wa.instanceName}
              onChange={e => setWa(p => ({ ...p, instanceName: e.target.value }))}
              placeholder="minha-instancia"
              disabled={waSaving}
              className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              API Key
              {waStatus?.connected && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  (deixe em branco para manter a atual)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={wa.apiKey}
                onChange={e => setWa(p => ({ ...p, apiKey: e.target.value }))}
                placeholder={waStatus?.connected ? '••••••••' : 'Sua API Key'}
                disabled={waSaving}
                className="w-full px-3.5 py-2.5 pr-10 bg-gray-800 border border-gray-700 text-white rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <a
              href="https://doc.evolution-api.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Documentação da Evolution API
            </a>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2 border-t border-gray-800">
            {waStatus?.connected && (
              <button
                onClick={handleWaDisconnect}
                disabled={waDisconnecting || waSaving}
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
              disabled={waLoading || waSaving}
              title="Atualizar status"
              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${waLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleWaSave}
              disabled={waSaving || (!wa.serverUrl || !wa.instanceName || (!wa.apiKey && !waStatus?.connected))}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {waSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Save className="w-4 h-4" /> {waStatus?.connected ? 'Atualizar' : 'Conectar'}</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Card Chatwoot ─────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">

        {/* Header do card */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Chatwoot</h2>
              <p className="text-xs text-gray-400">
                Sincronize conversas e crie leads automaticamente
              </p>
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

        {/* Formulário */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              URL do Chatwoot
            </label>
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
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Account ID
            </label>
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
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  (deixe em branco para manter o atual)
                </span>
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

          {/* Info webhook */}
          {cwStatus?.connected && (
            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-xs font-medium text-gray-300 mb-1">URL do Webhook</p>
              <p className="text-xs text-gray-400 font-mono break-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/chatwoot
                {process.env.NEXT_PUBLIC_CHATWOOT_WEBHOOK_SECRET
                  ? `?secret=${process.env.NEXT_PUBLIC_CHATWOOT_WEBHOOK_SECRET}`
                  : '?secret=SEU_SECRET'}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Configure este URL em Configurações → Integrações → Webhooks no Chatwoot.
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

          {/* Botões */}
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
    </div>
  )
}
