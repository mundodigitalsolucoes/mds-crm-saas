'use client'

import { Loader2, Mail, ShieldCheck, X } from 'lucide-react'

export default function EmailChannelModal({
  open,
  loading,
  onClose,
  onConnectGoogle,
}: {
  open: boolean
  loading: boolean
  onClose: () => void
  onConnectGoogle: () => void
}) {
  if (!open) return null

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
                Google Workspace ou Gmail com autorização segura.
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

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            Entre com a conta que será usada no Atendimento e autorize o acesso
            ao e-mail. O Google devolverá a autorização diretamente ao canal.
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                O CRM não recebe nem armazena sua senha do Google. O canal usa
                OAuth para receber e responder e-mails com segurança.
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
              type="button"
              onClick={onConnectGoogle}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#374b89] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2f3453] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Conectar com Google
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
