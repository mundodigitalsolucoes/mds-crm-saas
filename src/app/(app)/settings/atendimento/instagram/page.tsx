'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Instagram,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react'

type InstagramConfig = {
  enabled: boolean
  instagramAccountName: string
  instagramHandle: string
  instagramBusinessId: string
  inboxName: string
  connectionMode: 'manual_setup' | 'embedded_signup'
  status: 'draft' | 'pending_connection' | 'connected' | 'error'
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

export default function AtendimentoInstagramPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [config, setConfig] = useState<InstagramConfig>({
    enabled: false,
    instagramAccountName: '',
    instagramHandle: '',
    instagramBusinessId: '',
    inboxName: 'Instagram Direct',
    connectionMode: 'embedded_signup',
    status: 'draft',
    notes: '',
  })

  useEffect(() => {
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

        setConfig(data.config)
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

    void loadConfig()
  }, [])

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

      setConfig(data.config)
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
        Voltar
      </Link>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Instagram className="h-7 w-7 text-[#374b89]" />
          <h1 className="text-2xl font-bold">Instagram Direct</h1>
          <span className="text-xs bg-amber-100 px-2 py-1 rounded">
            {config.status}
          </span>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded bg-blue-100 text-blue-800 text-sm">
          {message}
        </div>
      )}

      <div className="bg-white p-5 rounded shadow-sm space-y-4">
        <input
          value={config.inboxName}
          onChange={(e) => updateField('inboxName', e.target.value)}
          className="border p-2 w-full"
          placeholder="Nome da inbox"
        />

        <input
          value={config.instagramHandle}
          onChange={(e) => updateField('instagramHandle', e.target.value)}
          className="border p-2 w-full"
          placeholder="@instagram"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}