import Link from 'next/link'
import { Users, Shield, ArrowRight } from 'lucide-react'
import ChatwootTeamsTab from '@/components/settings/ChatwootTeamsTab'

export default function AtendimentoEquipesPage() {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#374b89]/10">
              <Users className="h-7 w-7 text-[#374b89]" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#2f3453]">
                Equipes e Agentes
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Organize os times do Chatwoot aqui. A gestão de membros da
                organização continua separada para não misturar operação com
                permissões administrativas.
              </p>
            </div>
          </div>

          <Link
            href="/settings/members"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Shield className="h-4 w-4" />
            Gerenciar membros
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <ChatwootTeamsTab />
      </div>
    </div>
  )
}