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
  Trash2,
  X,
} from 'lucide-react'

type Tab = 'agentes' | 'equipes' | 'inboxes'

type Agent = {
  userId: string
  name: string
  email: string
  role: string
  chatwootUserId: number | null
  matchedInAtendimento: boolean
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
  channel?: string
  channelLabel?: string
  channelType?: string | null
  canal?: string
  canalLabel?: string
  canalType?: string | null
}

async function readApi(res: Response) {
  const text = await res.text()

  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {
      error: 'Resposta inválida da API',
      detail: text.slice(0, 300),
    }
  }
}

function apiErrorMessage(data: any, fallback: string) {
  const value = data?.detail || data?.error

  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (
    normalized.startsWith('<!doctype') ||
    normalized.startsWith('<html') ||
    normalized.includes('<body') ||
    normalized.includes('</html>')
  ) {
    return fallback
  }

  return value
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
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null)

  const [managingTeam, setManagingTeam] = useState<Team | null>(null)
  const [teamMemberIds, setTeamMemberIds] = useState<number[]>([])

  const [managingInbox, setManagingInbox] = useState<InboxItem | null>(null)
  const [inboxMemberIds, setInboxMemberIds] = useState<number[]>([])

  const [loadingMembers, setLoadingMembers] = useState(false)
  const [updatingAgentId, setUpdatingAgentId] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    try {
      const [agentsRes, teamsRes, inboxesRes] = await Promise.all([
        fetch('/api/atendimento/agentes'),
        fetch('/api/atendimento/equipes'),
        fetch('/api/atendimento/inboxes'),
      ])

      const agentsData = await readApi(agentsRes)
      const teamsData = await readApi(teamsRes)
      const inboxesData = await readApi(inboxesRes)

      if (!agentsRes.ok) {
        throw new Error(apiErrorMessage(agentsData, 'Erro ao carregar agentes'))
      }

      if (!teamsRes.ok) {
        throw new Error(apiErrorMessage(teamsData, 'Erro ao carregar equipes'))
      }

      if (!inboxesRes.ok) {
        throw new Error(apiErrorMessage(inboxesData, 'Erro ao carregar inboxes'))
      }

      setAgents(Array.isArray(agentsData.agents) ? agentsData.agents : [])
      setTeams(Array.isArray(teamsData.teams) ? teamsData.teams : [])
      setInboxes(Array.isArray(inboxesData.inboxes) ? inboxesData.inboxes : [])
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar operação',
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
      const res = await fetch('/api/atendimento/agentes/sync', { method: 'POST' })
      const data = await readApi(res)

      if (!res.ok) {
        throw new Error(apiErrorMessage(data, 'Erro ao sincronizar agentes'))
      }

      setMessage({
        type: 'success',
        text: `Sync concluído. ${data.updated ?? 0} usuário(s) atualizado(s).`,
      })

      await fetchAll()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao sincronizar agentes',
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) {
      setMessage({ type: 'error', text: 'Informe o nome da equipe' })
      return
    }

    setCreatingTeam(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/equipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || undefined,
        }),
      })

      const data = await readApi(res)

      if (!res.ok) {
        throw new Error(apiErrorMessage(data, 'Erro ao criar equipe'))
      }

      setMessage({ type: 'success', text: 'Equipe criada com sucesso.' })
      setTeamName('')
      setTeamDescription('')
      await fetchAll()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao criar equipe',
      })
    } finally {
      setCreatingTeam(false)
    }
  }

  async function handleDeleteTeam(teamId: number) {
    if (!window.confirm('Deseja realmente excluir esta equipe?')) return

    setDeletingTeamId(teamId)
    setMessage(null)

    try {
      const res = await fetch(`/api/atendimento/equipes/${teamId}`, {
        method: 'DELETE',
      })

      const data = await readApi(res)

      if (!res.ok) {
        throw new Error(apiErrorMessage(data, 'Erro ao excluir equipe'))
      }

      setMessage({ type: 'success', text: 'Equipe excluída com sucesso.' })
      await fetchAll()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao excluir equipe',
      })
    } finally {
      setDeletingTeamId(null)
    }
  }

  async function openTeamManager(team: Team) {
    setManagingTeam(team)
    setManagingInbox(null)
    setTeamMemberIds([])
    setInboxMemberIds([])
    setLoadingMembers(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/atendimento/equipes/${team.id}/members`)
      const data = await readApi(res)

      if (!res.ok) {
        throw new Error(apiErrorMessage(data, 'Erro ao carregar agentes da equipe'))
      }

      setTeamMemberIds(Array.isArray(data.memberIds) ? data.memberIds : [])
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar agentes da equipe',
      })
      setManagingTeam(null)
    } finally {
      setLoadingMembers(false)
    }
  }

  async function openInboxManager(inbox: InboxItem) {
    setManagingInbox(inbox)
    setManagingTeam(null)
    setInboxMemberIds([])
    setTeamMemberIds([])
    setLoadingMembers(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/atendimento/inboxes/${inbox.id}/members`)
      const data = await readApi(res)

      if (!res.ok) {
        throw new Error(apiErrorMessage(data, 'Erro ao carregar agentes da inbox'))
      }

      setInboxMemberIds(Array.isArray(data.memberIds) ? data.memberIds : [])
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar agentes da inbox',
      })
      setManagingInbox(null)
    } finally {
      setLoadingMembers(false)
    }
  }

  async function toggleTeamMember(agent: Agent) {
    if (!managingTeam || !agent.chatwootUserId) return

    const agentId = agent.chatwootUserId
    const isMember = teamMemberIds.includes(agentId)

    setUpdatingAgentId(agentId)
    setMessage(null)

    try {
      const res = await fetch(`/api/atendimento/equipes/${managingTeam.id}/members`, {
        method: isMember ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })

      const data = await readApi(res)

      if (!res.ok) {
        throw new Error(
          apiErrorMessage(
            data,
            isMember ? 'Erro ao remover agente da equipe' : 'Erro ao adicionar agente na equipe'
          )
        )
      }

      setTeamMemberIds((current) =>
        isMember ? current.filter((id) => id !== agentId) : [...current, agentId]
      )

      setTeams((currentTeams) =>
        currentTeams.map((team) => {
          if (team.id !== managingTeam.id) return team

          const currentCount = team.agents_count ?? 0

          return {
            ...team,
            agents_count: isMember ? Math.max(currentCount - 1, 0) : currentCount + 1,
          }
        })
      )
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao atualizar agentes da equipe',
      })
    } finally {
      setUpdatingAgentId(null)
    }
  }

  async function toggleInboxMember(agent: Agent) {
    if (!managingInbox || !agent.chatwootUserId) return

    const agentId = agent.chatwootUserId
    const isMember = inboxMemberIds.includes(agentId)

    setUpdatingAgentId(agentId)
    setMessage(null)

    try {
      const res = await fetch(`/api/atendimento/inboxes/${managingInbox.id}/members`, {
        method: isMember ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentIds: [agentId] }),
      })

      const data = await readApi(res)

      if (!res.ok) {
        throw new Error(
          apiErrorMessage(
            data,
            isMember ? 'Erro ao remover agente da inbox' : 'Erro ao adicionar agente na inbox'
          )
        )
      }

      setInboxMemberIds((current) =>
        isMember ? current.filter((id) => id !== agentId) : [...current, agentId]
      )
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao atualizar agentes da inbox',
      })
    } finally {
      setUpdatingAgentId(null)
    }
  }

  const linkedAgents = agents.filter((agent) => agent.chatwootUserId)

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
                Gerencie agentes, equipes e inboxes sem recriar a engine nativa do Atendimento.
              </p>
            </div>
          </div>

          <Link
            href="/settings/members"
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
                    <h2 className="font-semibold text-[#2f3453]">Agentes</h2>
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
                  {agents.length === 0 && (
                    <div className="p-4 text-sm text-slate-500">
                      Nenhum agente encontrado.
                    </div>
                  )}

                  {agents.map((agent) => (
                    <div
                      key={agent.userId}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{agent.name}</p>
                        <p className="text-sm text-slate-500">{agent.email}</p>
                      </div>

                      <div className="text-right text-sm">
                        <p className="font-semibold text-slate-700">
                          {agent.chatwootUserId ? `ID ${agent.chatwootUserId}` : 'Sem vínculo'}
                        </p>
                        <p className={agent.matchedInAtendimento ? 'text-emerald-600' : 'text-amber-600'}>
                          {agent.matchedInAtendimento ? 'Encontrado no Atendimento' : 'Não encontrado'}
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
                  <h2 className="font-semibold text-[#2f3453]">Nova equipe</h2>

                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Nome da equipe"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />

                  <input
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
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
                  {teams.length === 0 && (
                    <div className="p-4 text-sm text-slate-500">
                      Nenhuma equipe encontrada.
                    </div>
                  )}

                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{team.name}</p>
                        {team.description && (
                          <p className="text-sm text-slate-500">{team.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {team.agents_count ?? 0} agente(s)
                        </span>

                        <button
                          onClick={() => openTeamManager(team)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#374b89]/20 bg-[#374b89]/10 px-3 py-2 text-sm font-semibold text-[#374b89] hover:bg-[#374b89]/15"
                        >
                          <Users className="h-4 w-4" />
                          Gerenciar agentes
                        </button>

                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          disabled={deletingTeamId === team.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60"
                        >
                          {deletingTeamId === team.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'inboxes' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-[#2f3453]">Inboxes / Canais</h2>
                  <p className="text-sm text-slate-500">
                    {inboxes.length} inbox(es) operacionais encontrados.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {inboxes.length === 0 && (
                    <div className="p-4 text-sm text-slate-500">
                      Nenhuma inbox encontrada.
                    </div>
                  )}

                  {inboxes.map((inbox) => (
                    <div
                      key={inbox.id}
                      className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#374b89]/10">
                          <Inbox className="h-5 w-5 text-[#374b89]" />
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">{inbox.name}</p>
                          <p className="text-sm text-slate-500">
                            {inbox.channelType ?? inbox.canalType ?? inbox.channel ?? inbox.canal ?? 'Canal'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {inbox.channelLabel ?? inbox.canalLabel ?? 'Canal'}
                        </span>

                        <button
                          onClick={() => openInboxManager(inbox)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#374b89]/20 bg-[#374b89]/10 px-3 py-2 text-sm font-semibold text-[#374b89] hover:bg-[#374b89]/15"
                        >
                          <Users className="h-4 w-4" />
                          Gerenciar agentes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(managingTeam || managingInbox) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-lg font-bold text-[#2f3453]">
                  Gerenciar agentes
                </h3>
                <p className="text-sm text-slate-500">
                  {managingTeam ? `Equipe: ${managingTeam.name}` : `Inbox: ${managingInbox?.name}`}
                </p>
              </div>

              <button
                onClick={() => {
                  setManagingTeam(null)
                  setManagingInbox(null)
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {loadingMembers ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#374b89]" />
                </div>
              ) : linkedAgents.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhum agente vinculado ao Atendimento. Sincronize os agentes antes de gerenciar vínculos.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {linkedAgents.map((agent) => {
                    const agentId = agent.chatwootUserId!
                    const checked = managingTeam
                      ? teamMemberIds.includes(agentId)
                      : inboxMemberIds.includes(agentId)

                    return (
                      <label
                        key={agent.userId}
                        className="flex cursor-pointer items-center justify-between gap-4 p-4 hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{agent.name}</p>
                          <p className="text-sm text-slate-500">{agent.email}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            ID Atendimento {agentId}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {updatingAgentId === agentId && (
                            <Loader2 className="h-4 w-4 animate-spin text-[#374b89]" />
                          )}

                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={updatingAgentId === agentId}
                            onChange={() =>
                              managingTeam ? toggleTeamMember(agent) : toggleInboxMember(agent)
                            }
                            className="h-5 w-5 rounded border-slate-300 text-[#374b89]"
                          />
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 p-5">
              <button
                onClick={() => {
                  setManagingTeam(null)
                  setManagingInbox(null)
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
