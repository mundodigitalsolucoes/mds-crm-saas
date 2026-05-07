'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Shield,
  ArrowRight,
  RefreshCw,
  Loader2,
  UserCheck,
  Inbox,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

type Tab = 'agentes' | 'equipes' | 'inboxes'

type Agent = {
  userId: string
  name: string
  email: string
  role: string
  chatwootUserId: number | null
  isChatwootAgent: boolean
  matchedInAtendimento: boolean
  atendimentoAgentId?: number | null
  atendimentoRole?: string | null
  availabilityStatus?: string | null
}

type Team = {
  id: number
  name: string
  description?: string
  agents_count?: number
}

type InboxItem = {
  id: number
  name: string
  channel: string
  channelLabel: string
  channelType: string | null
}

export default function AtendimentoEquipesPage() {
  const [tab, setTab] = useState<Tab>('agentes')
  const [loading, setLoading] = useState(true)

  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [agents, setAgents] = useState<Agent[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [inboxes, setInboxes] = useState<InboxItem[]>([])

  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')

  const [creatingTeam, setCreatingTeam] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)

    try {
      const [agentsRes, teamsRes, inboxesRes] = await Promise.all([
        fetch('/api/atendimento/agentes'),
        fetch('/api/atendimento/equipes'),
        fetch('/api/atendimento/inboxes'),
      ])

      const agentsData = await agentsRes.json()
      const teamsData = await teamsRes.json()
      const inboxesData = await inboxesRes.json()

      if (!agentsRes.ok) {
        throw new Error(agentsData.error || 'Erro ao carregar agentes')
      }

      if (!teamsRes.ok) {
        throw new Error(teamsData.error || 'Erro ao carregar equipes')
      }

      if (!inboxesRes.ok) {
        throw new Error(inboxesData.error || 'Erro ao carregar inboxes')
      }

      setAgents(agentsData.agents ?? [])
      setTeams(teamsData.teams ?? [])
      setInboxes(inboxesData.inboxes ?? [])
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Erro ao carregar operação',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function handleSyncAgents() {
    setSyncing(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/agentes/sync', {
        method: 'POST',
      })

      const text = await res.text()

      let data: {
        error?: string
        detail?: string
        updated?: number
      } = {}

      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = {
          error: 'Resposta inválida da API',
          detail: text.slice(0, 300),
        }
      }

      if (!res.ok) {
        throw new Error(
          data.detail || data.error || 'Erro ao sincronizar agentes'
        )
      }

      setMessage({
        type: 'success',
        text: `Sync concluído. ${data.updated ?? 0} usuário(s) atualizado(s).`,
      })

      await fetchAll()
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Erro ao sincronizar agentes',
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) {
      setMessage({
        type: 'error',
        text: 'Informe o nome da equipe',
      })

      return
    }

    setCreatingTeam(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/equipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || undefined,
        }),
      })

      const text = await res.text()

      let data: {
        error?: string
        detail?: string
      } = {}

      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = {
          error: 'A API retornou uma resposta inválida ao criar equipe',
          detail: text.slice(0, 300),
        }
      }

      if (!res.ok) {
        throw new Error(
          data.detail || data.error || 'Erro ao criar equipe'
        )
      }

      setMessage({
        type: 'success',
        text: 'Equipe criada com sucesso.',
      })

      setTeamName('')
      setTeamDescription('')

      await fetchAll()
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Erro ao criar equipe',
      })
    } finally {
      setCreatingTeam(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#374b89]/10">
              <Users className="h-7 w-7 text-[#374b89]" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#2f3453]">
                Operações do Atendimento
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Gerencie agentes, equipes e inboxes sem recriar a engine
                nativa do Atendimento.
              </p>
            </div>
          </div>

          <Link
            href="/settings/membros"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Shield className="h-4 w-4" />
            Gerenciar membros
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}

          <span>{message.text}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex gap-2">
            {[
              ['agentes', 'Agentes'],
              ['equipes', 'Equipes'],
              ['inboxes', 'Inboxes'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value as Tab)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab === value
                    ? 'bg-[#374b89] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#374b89]" />
          </div>
        ) : (
          <div className="p-5">
            {tab === 'agentes' && (
              <div className="space-y-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#2f3453]">
                      Agentes
                    </h2>

                    <p className="text-sm text-slate-500">
                      {agents.length} membro(s) ativos encontrados.
                    </p>
                  </div>

                  <button
                    onClick={handleSyncAgents}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}

                    Sincronizar agentes
                  </button>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {agents.map((agent) => (
                    <div
                      key={agent.userId}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {agent.name}
                        </p>

                        <p className="text-sm text-slate-500">
                          {agent.email}
                        </p>
                      </div>

                      <div className="text-right text-sm">
                        <p className="font-semibold text-slate-700">
                          {agent.chatwootUserId
                            ? `ID ${agent.chatwootUserId}`
                            : 'Sem vínculo'}
                        </p>

                        <p
                          className={
                            agent.matchedInAtendimento
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }
                        >
                          {agent.matchedInAtendimento
                            ? 'Encontrado no Atendimento'
                            : 'Não encontrado'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'equipes' && (
              <div className="space-y-5">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="font-semibold text-[#2f3453]">
                    Nova equipe
                  </h2>

                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Nome da equipe"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />

                  <input
                    value={teamDescription}
                    onChange={(e) =>
                      setTeamDescription(e.target.value)
                    }
                    placeholder="Descrição opcional"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />

                  <button
                    onClick={handleCreateTeam}
                    disabled={creatingTeam}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {creatingTeam ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}

                    Criar equipe
                  </button>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {team.name}
                        </p>

                        {team.description && (
                          <p className="text-sm text-slate-500">
                            {team.description}
                          </p>
                        )}
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {team.agents_count ?? 0} agente(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'inboxes' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-[#2f3453]">
                    Inboxes / Canais
                  </h2>

                  <p className="text-sm text-slate-500">
                    {inboxes.length} inbox(es) operacionais encontrados.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {inboxes.map((inbox) => (
                    <div
                      key={inbox.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#374b89]/10">
                          <Inbox className="h-5 w-5 text-[#374b89]" />
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">
                            {inbox.name}
                          </p>

                          <p className="text-sm text-slate-500">
                            {inbox.channelType ?? inbox.channel}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {inbox.channelLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}