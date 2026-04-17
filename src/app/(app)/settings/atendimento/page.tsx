import Link from 'next/link'
import {
  MessageSquare,
  Smartphone,
  Users,
  MessageCircleMore,
  Bot,
  BarChart3,
  ChevronRight,
  CheckCircle2,
  Clock3,
} from 'lucide-react'

const cards = [
  {
    title: 'Canais',
    description:
      'Gerencie números de WhatsApp, status de conexão e operação dos canais.',
    href: '/settings/atendimento/canais',
    icon: Smartphone,
    status: 'ativo' as const,
  },
  {
    title: 'Equipes e Agentes',
    description:
      'Organize os times do Chatwoot e mantenha a operação separada da gestão de membros.',
    href: '/settings/atendimento/equipes',
    icon: Users,
    status: 'ativo' as const,
  },
  {
    title: 'Respostas Rápidas',
    description:
      'Área preparada para padronizar atalhos, scripts e mensagens de atendimento.',
    href: '/settings/atendimento/respostas',
    icon: MessageCircleMore,
    status: 'preparacao' as const,
  },
  {
    title: 'Automações',
    description:
      'Espaço reservado para regras operacionais e automações nativas do atendimento.',
    href: '/settings/atendimento/automacoes',
    icon: Bot,
    status: 'preparacao' as const,
  },
  {
    title: 'Relatórios',
    description:
      'Visão executiva do atendimento para acompanhamento de operação e performance.',
    href: '/settings/atendimento/relatorios',
    icon: BarChart3,
    status: 'preparacao' as const,
  },
]

function StatusBadge({ status }: { status: 'ativo' | 'preparacao' }) {
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Ativo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
      <Clock3 className="h-3.5 w-3.5" />
      Em preparação
    </span>
  )
}

export default function AtendimentoSettingsPage() {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#374b89]/10">
            <MessageSquare className="h-7 w-7 text-[#374b89]" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[#2f3453]">
              Configurações do Atendimento
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Centralize aqui a operação do Atendimento sem reinventar o Chatwoot
              dentro do CRM. Canais, equipes e futuras áreas operacionais ficam
              organizadas em uma trilha própria.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#374b89]/15 bg-gradient-to-r from-white to-[#f7f9ff] p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#374b89]">
              Trilha oficial
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Use <strong>Canais</strong> para operação dos números e{' '}
              <strong>Equipes e Agentes</strong> para organização dos times do atendimento.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge status="ativo" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#374b89]/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2f3453]">
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[#2f3453]">
                        {card.title}
                      </h2>
                      <StatusBadge status={card.status} />
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {card.description}
                    </p>
                  </div>
                </div>

                <ChevronRight className="mt-1 h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}