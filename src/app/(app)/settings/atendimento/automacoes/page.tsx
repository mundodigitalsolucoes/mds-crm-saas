import Link from 'next/link'
import { Bot, ArrowLeft } from 'lucide-react'

export default function AtendimentoAutomacoesPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#374b89]/10">
          <Bot className="h-7 w-7 text-[#374b89]" />
        </div>

        <h1 className="mt-4 text-2xl font-bold text-[#2f3453]">
          Automações
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta área foi reservada para a camada de automações operacionais do
          atendimento, respeitando a lógica nativa do Chatwoot.
        </p>

        <Link
          href="/settings/atendimento"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>
    </div>
  )
}