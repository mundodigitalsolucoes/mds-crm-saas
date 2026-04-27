'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Instagram,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
} from 'lucide-react'

type InstagramConfig = {
  enabled: boolean
  instagramAccountName: string
  instagramHandle: string
  instagramBusinessId: string
  inboxName: string
  connectionMode: 'meta_api' | 'manual_token'
  status: 'draft' | 'pending_connection' | 'token_received' | 'connected' | 'error'
  notes: string
}

type OrgScope = {
  id: string
  name: string
  slug: string
  plan: string
}

type InstagramResponse = {
  orgScope: OrgScope
  config: InstagramConfig
  defaults: InstagramConfig
  savedAt: string
}

type InstagramAccount = {
  facebookPageId: string
  facebookPageName: string
  hasInstagramBusinessAccount: boolean
  instagramBusinessId: string
  instagramAccountName: string
  instagramUsername: string
  instagramHandle: string
}

type AccountsResponse = {
  success: boolean
  total: number
  accounts: InstagramAccount[]
}

type SelectAccountResponse = {
  success: boolean
  status: 'connected'
  facebookPage: {
    id: string
    name: string
  }
  instagram: {
    id: string
    name: string
    username: string
    handle: string
  }
}

export default function AtendimentoInstagramPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [selectingAccount, setSelectingAccount] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<InstagramAccount[]>([])
  const [selectedAccountKey, setSelectedAccountKey] = useState('')

  const [config, setConfig] = useState<InstagramConfig>({
    enabled: false,
    instagramAccountName: '',
    instagramHandle: '',
    instagramBusinessId: '',
    inboxName: 'Instagram Direct',
    connectionMode: 'meta_api',
    status: 'draft',
    notes: '',
  })

  async function loadConfig() {
    try {
      const res = await fetch('/api/atendimento/instagram', {
        method: 'GET',
        credentials: 'include',
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw error
      }

      const data: InstagramResponse = await res.json()

      setConfig({
        ...data.config,
        connectionMode:
          data.config.connectionMode === 'manual_token'
            ? 'manual_token'
            : 'meta_api',
      })
      setOrgScope(data.orgScope)
      setSavedAt(data.savedAt)
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.error ||
          error?.message ||
          'Erro ao carregar configuração do Instagram'
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadAccounts() {
    setLoadingAccounts(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/instagram/accounts', {
        method: 'GET',
        credentials: 'include',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw data
      }

      const accountsData = data as AccountsResponse
      const validAccounts = accountsData.accounts.filter(
        (account) => account.hasInstagramBusinessAccount
      )

      setAccounts(validAccounts)

      if (validAccounts.length === 0) {
        setMessage(
          'Nenhuma conta Instagram Business autorizada foi encontrada. Refaça a conexão com a Meta.'
        )
      }
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.error ||
          error?.details ||
          error?.message ||
          'Erro ao listar contas Instagram autorizadas.'
      )
    } finally {
      setLoadingAccounts(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  useEffect(() => {
    if (config.status !== 'draft') {
      void loadAccounts()
    }
  }, [config.status])

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/instagram', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw error
      }

      const data: InstagramResponse = await res.json()

      setConfig({
        ...data.config,
        connectionMode:
          data.config.connectionMode === 'manual_token'
            ? 'manual_token'
            : 'meta_api',
      })
      setOrgScope(data.orgScope)
      setSavedAt(data.savedAt)
      setMessage('Configuração salva com sucesso.')
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.error ||
          error?.message ||
          'Erro ao salvar configuração do Instagram'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSelectAccount() {
    const selectedAccount = accounts.find(
      (account) =>
        `${account.facebookPageId}:${account.instagramBusinessId}` ===
        selectedAccountKey
    )

    if (!selectedAccount) {
      setMessage('Selecione uma conta Instagram autorizada.')
      return
    }

    setSelectingAccount(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/instagram/select-account', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facebookPageId: selectedAccount.facebookPageId,
          instagramBusinessId: selectedAccount.instagramBusinessId,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw data
      }

      const selectedData = data as SelectAccountResponse

      setConfig((current) => ({
        ...current,
        enabled: true,
        status: selectedData.status,
        instagramAccountName:
          selectedData.instagram.name || selectedAccount.instagramAccountName,
        instagramHandle:
          selectedData.instagram.handle || selectedAccount.instagramHandle,
        instagramBusinessId:
          selectedData.instagram.id || selectedAccount.instagramBusinessId,
      }))

      await loadConfig()
      setMessage('Conta Instagram selecionada e sincronizada com sucesso.')
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.error ||
          error?.details ||
          error?.message ||
          'Erro ao selecionar conta Instagram.'
      )
    } finally {
      setSelectingAccount(false)
    }
  }

  function updateField<K extends keyof InstagramConfig>(
    field: K,
    value: InstagramConfig[K]
  ) {
    setConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Link
        href="/settings/atendimento"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#374b89] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Configurações do Atendimento
      </Link>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#374b89]/10">
              <Instagram className="h-7 w-7 text-[#374b89]" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-[#2f3453]">
                  Instagram Direct
                </h1>

                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  {config.status === 'draft' ? 'Rascunho' : config.status}
                </span>
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Canal Instagram operado via provider próprio do CRM com Meta
                Instagram Messaging API. As mensagens serão recebidas e enviadas
                pelo CRM e exibidas no Atendimento através de uma inbox API
                dedicada.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-[#374b89]" />
            Provider próprio + inbox API
          </span>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          {message}
        </div>
      )}

      {orgScope && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">
            Escopo da organização
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Organização
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">
                {orgScope.name}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Slug
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">
                {orgScope.slug}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Plano
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">
                {orgScope.plan}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Último salvamento
              </p>
              <p className="mt-2 text-sm font-bold text-[#2f3453]">
                {savedAt ? new Date(savedAt).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">
            Configuração do provider
          </h2>

          <div className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => updateField('enabled', e.target.checked)}
              />
              <div>
                <p className="text-sm font-semibold text-[#2f3453]">
                  Canal Instagram habilitado no CRM
                </p>
                <p className="text-xs text-slate-500">
                  Controla apenas a configuração do provider. A ativação real
                  depende da conexão Meta e da inbox API no Atendimento.
                </p>
              </div>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="block flex-1 space-y-2">
                  <span className="text-sm font-semibold text-[#2f3453]">
                    Conta Instagram autorizada
                  </span>
                  <select
                    value={selectedAccountKey}
                    onChange={(e) => setSelectedAccountKey(e.target.value)}
                    disabled={loadingAccounts || accounts.length === 0}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#374b89] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {loadingAccounts
                        ? 'Carregando contas...'
                        : 'Selecione uma conta'}
                    </option>
                    {accounts.map((account) => (
                      <option
                        key={`${account.facebookPageId}:${account.instagramBusinessId}`}
                        value={`${account.facebookPageId}:${account.instagramBusinessId}`}
                      >
                        {account.instagramHandle || account.instagramAccountName} —{' '}
                        {account.facebookPageName}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={handleSelectAccount}
                  disabled={
                    selectingAccount ||
                    loadingAccounts ||
                    !selectedAccountKey ||
                    accounts.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#374b89]/30 bg-white px-5 py-3 text-sm font-semibold text-[#374b89] shadow-sm transition hover:bg-[#374b89]/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectingAccount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Usar esta conta
                </button>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Para SaaS, a conta deve ser escolhida por organização. O CRM não
                seleciona automaticamente a primeira página retornada pela Meta.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#2f3453]">
                Nome da inbox API no Atendimento
              </span>
              <input
                value={config.inboxName}
                onChange={(e) => updateField('inboxName', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                placeholder="Instagram Direct"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  Nome da conta Instagram
                </span>
                <input
                  value={config.instagramAccountName}
                  onChange={(e) =>
                    updateField('instagramAccountName', e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="Ex: Mundo Digital Soluções"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#2f3453]">
                  @ do Instagram
                </span>
                <input
                  value={config.instagramHandle}
                  onChange={(e) =>
                    updateField('instagramHandle', e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                  placeholder="@mundodigital.solucoes"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#2f3453]">
                Instagram Business ID
              </span>
              <input
                value={config.instagramBusinessId}
                onChange={(e) =>
                  updateField('instagramBusinessId', e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                placeholder="Preenchido após conexão com a Meta"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#2f3453]">
                Modo de conexão
              </span>
              <select
                value={config.connectionMode}
                onChange={(e) =>
                  updateField(
                    'connectionMode',
                    e.target.value as InstagramConfig['connectionMode']
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
              >
                <option value="meta_api">Meta API</option>
                <option value="manual_token">Token manual</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#2f3453]">
                Observações internas
              </span>
              <textarea
                value={config.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
                placeholder="Anotações sobre conta, responsável, pendências Meta ou validações."
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2f3453] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar configuração
              </button>

              <button
                onClick={loadAccounts}
                disabled={loadingAccounts || config.status === 'draft'}
                className="inline-flex items-center gap-2 rounded-xl border border-[#374b89]/30 bg-white px-5 py-3 text-sm font-semibold text-[#374b89] shadow-sm transition hover:bg-[#374b89]/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAccounts ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Atualizar contas autorizadas
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">
            Próximas etapas
          </h2>

          <div className="mt-5 space-y-3">
            {[
              'Salvar configuração base do provider',
              'Criar fluxo de conexão com a Meta',
              'Selecionar conta Instagram por organização',
              'Configurar webhook de recebimento',
              'Criar inbox API no Atendimento',
              'Ativar operação com agentes',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#374b89]" />
                <p className="text-sm leading-5 text-slate-600">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              Atenção
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-700">
              Em ambiente SaaS, cada organização deve escolher explicitamente a
              Página Facebook e a conta Instagram autorizada que deseja operar.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}