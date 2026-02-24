// src/components/settings/ChatwootTeamsTab.tsx
// Aba "Times" na página de membros
// Lista times do Chatwoot e permite criar novos

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Link2Off,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ChatwootTeam {
  id:          number
  name:        string
  description: string
  agents_count?: number
}

interface TeamsResponse {
  connected: boolean
  teams?:    ChatwootTeam[]
  error?:    string
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ChatwootTeamsTab() {
  const [loading, setLoading]   = useState(true)
  const [connected, setConnected] = useState(false)
  const [teams, setTeams]       = useState<ChatwootTeam[]>([])
  const [error, setError]       = useState<string | null>(null)

  // Form novo time
  const [showForm, setShowForm]       = useState(false)
  const [formName, setFormName]       = useState('')
  const [formDesc, setFormDesc]       = useState('')
  const [creating, setCreating]       = useState(false)
  const [createMsg, setCreateMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ─── Fetch times ───────────────────────────────────────────────────────────

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res  = await fetch('/api/integrations/chatwoot/teams')
      const data = await res.json() as TeamsResponse

      if (!res.ok) {
        setError(data.error ?? 'Erro ao buscar times')
        return
      }

      setConnected(data.connected)
      setTeams(data.teams ?? [])
    } catch {
      setError('Erro de conexão ao buscar times')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  // ─── Criar time ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formName.trim()) {
      setCreateMsg({ type: 'error', text: 'Informe o nome do time' })
      return
    }

    setCreating(true)
    setCreateMsg(null)

    try {
      const res  = await fetch('/api/integrations/chatwoot/teams', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: formName.trim(), description: formDesc.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setCreateMsg({ type: 'error', text: data.error ?? 'Erro ao criar time' })
        return
      }

      setCreateMsg({ type: 'success', text: `Time "${formName}" criado com sucesso!` })
      setTeams((prev) => [...prev, data.team as ChatwootTeam])

      setTimeout(() => {
        setShowForm(false)
        setFormName('')
        setFormDesc('')
        setCreateMsg(null)
      }, 1500)
    } catch {
      setCreateMsg({ type: 'error', text: 'Erro de conexão' })
    } finally {
      setCreating(false)
    }
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setFormName('')
    setFormDesc('')
    setCreateMsg(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  // Chatwoot não conectado
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-6">
        <Link2Off className="w-10 h-10 text-gray-300" />
        <p className="text-gray-500 font-medium">Chatwoot não conectado</p>
        <p className="text-sm text-gray-400 max-w-sm">
          Configure a integração com o Chatwoot em{' '}
          <span className="font-medium text-indigo-500">Configurações → Integrações</span>{' '}
          para gerenciar times de atendimento.
        </p>
      </div>
    )
  }

  // Erro de API
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={fetchTeams}
            className="ml-auto text-red-600 hover:text-red-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Times do Chatwoot</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {teams.length} {teams.length === 1 ? 'time' : 'times'} configurado{teams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTeams}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            disabled={showForm}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Time
          </button>
        </div>
      </div>

      {/* Form criar time */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-900">Novo Time</h3>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nome do time <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: Suporte, Vendas, Financeiro..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Descrição <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Descreva a função deste time..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            />
          </div>

          {createMsg && (
            <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
              createMsg.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {createMsg.type === 'success'
                ? <Check className="w-4 h-4 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0" />
              }
              {createMsg.text}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={handleCancelForm}
              disabled={creating}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {creating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5" />
              }
              {creating ? 'Criando...' : 'Criar Time'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de times */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <Users className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-400">Nenhum time criado ainda</p>
          <p className="text-xs text-gray-400">Clique em "Novo Time" para começar</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{team.name}</p>
                  {team.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{team.description}</p>
                  )}
                </div>
              </div>
              {typeof team.agents_count === 'number' && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                  {team.agents_count} {team.agents_count === 1 ? 'agente' : 'agentes'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
