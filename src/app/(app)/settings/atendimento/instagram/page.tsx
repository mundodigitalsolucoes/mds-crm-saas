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
  facebookPageId: string
  facebookPageName: string
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
    facebookPageId: '',
    facebookPageName: '',
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
      const res = await fetch('/api/atendimento/instagram')

      if (!res.ok) throw await res.json()

      const data: InstagramResponse = await res.json()

      setConfig(data.config)

      if (data.config.facebookPageId && data.config.instagramBusinessId) {
        setSelectedAccountKey(
          `${data.config.facebookPageId}:${data.config.instagramBusinessId}`
        )
      }

      setOrgScope(data.orgScope)
      setSavedAt(data.savedAt)
    } catch (error: any) {
      setMessage(error?.error || 'Erro ao carregar configuração')
    } finally {
      setLoading(false)
    }
  }

  async function loadAccounts() {
    setLoadingAccounts(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/instagram/accounts')
      const data = await res.json()

      if (!res.ok) throw data

      setAccounts(data.accounts.filter((a: any) => a.hasInstagramBusinessAccount))
    } catch (error: any) {
      setMessage(error?.error || 'Erro ao listar contas')
    } finally {
      setLoadingAccounts(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    if (config.status !== 'draft') loadAccounts()
  }, [config.status])

  async function handleSelectAccount() {
    const selected = accounts.find(
      (a) =>
        `${a.facebookPageId}:${a.instagramBusinessId}` === selectedAccountKey
    )

    if (!selected) {
      setMessage('Selecione uma conta')
      return
    }

    setSelectingAccount(true)
    setMessage(null)

    try {
      const res = await fetch('/api/atendimento/instagram/select-account', {
        method: 'POST',
        body: JSON.stringify({
          facebookPageId: selected.facebookPageId,
          instagramBusinessId: selected.instagramBusinessId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw data

      setConfig((c) => ({
        ...c,
        facebookPageId: data.facebookPage.id,
        facebookPageName: data.facebookPage.name,
        instagramBusinessId: data.instagram.id,
        instagramAccountName: data.instagram.name,
        instagramHandle: data.instagram.handle,
        status: data.status,
        enabled: true,
      }))

      await loadConfig()
      setMessage('Conta conectada')
    } catch (e: any) {
      setMessage(e?.error || 'Erro ao selecionar')
    } finally {
      setSelectingAccount(false)
    }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="p-6 space-y-6">
      <Link href="/settings/atendimento">Voltar</Link>

      <div className="space-y-4">
        <select
          value={selectedAccountKey}
          onChange={(e) => setSelectedAccountKey(e.target.value)}
        >
          <option value="">Selecione</option>
          {accounts.map((a) => (
            <option
              key={`${a.facebookPageId}:${a.instagramBusinessId}`}
              value={`${a.facebookPageId}:${a.instagramBusinessId}`}
            >
              {a.instagramHandle} - {a.facebookPageName}
            </option>
          ))}
        </select>

        <button onClick={handleSelectAccount} disabled={selectingAccount}>
          {selectingAccount ? 'Conectando...' : 'Usar conta'}
        </button>
      </div>

      {message && <div>{message}</div>}
    </div>
  )
}