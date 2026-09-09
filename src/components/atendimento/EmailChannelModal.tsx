'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, Mail, ShieldCheck, X } from 'lucide-react'

export type EmailChannelForm = {
  name: string
  email: string
  appPassword: string
}

export default function EmailChannelModal({
  open,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  onClose: () => void
  onSubmit: (form: EmailChannelForm) => void
}) {
  const [form, setForm] = useState<EmailChannelForm>({
    name: 'E-mail MDS',
    email: 'contato@mundodigitalsolucoes.com.br',
    appPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm((current) => ({ ...current, appPassword: '' }))
      setShowPassword(false)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374b89]/10">
              <Mail className="h-6 w-6 text-[#374b89]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2f3453]">
                Conectar E-mail
              </h2>
              <p className="text-sm text-slate-500">
                Google Workspace ou Gmail via IMAP/SMTP.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[#2f3453]">
              Nome do canal
            </span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              maxLength={60}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[#2f3453]">
              Endereço de e-mail
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#374b89]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[#2f3453]">
              Senha de app do Google
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.appPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    appPassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
                minLength={16}
                required
                placeholder="Senha de app com 16 caracteres"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none focus:border-[#374b89]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Use uma senha de app gerada na Conta Google. A senha comum da
              conta não funciona e não deve ser informada aqui.
            </p>
          </label>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                O CRM não salva nem exibe essa senha. Ela é enviada apenas para
                validar e ativar o canal de Atendimento.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2f3453] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Validar e conectar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
