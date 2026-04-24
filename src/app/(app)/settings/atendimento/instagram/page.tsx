import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Instagram,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react'

const implementationSteps = [
  {
    title: 'Inbox separada',
    description:
      'O Instagram Direct será tratado como canal próprio dentro do Atendimento, sem misturar com WhatsApp ou Widget.',
  },
  {
    title: 'Conexão via Atendimento',
    description:
      'A operação de mensagens deve permanecer no backend operacional do Atendimento, respeitando a lógica nativa de inbox.',
  },
  {
    title: 'Governança pelo CRM',
    description:
      'O CRM deve organizar status, vínculo com organização, agentes, plano comercial e contexto de vendas.',
  },
  {
    title: 'Integração comercial',
    description:
      'Depois da inbox ativa, a conversa poderá ser relacionada a Leads, oportunidades e pipeline de vendas.',
  },
]

const requirements = [
  'Conta Instagram profissional',
  'Conta vinculada corretamente ao ecossistema Meta',
  'Inbox própria no Atendimento',
  'Agentes definidos para atendimento',
  'Plano SaaS com canal Instagram habilitado',
]

export default function AtendimentoInstagramPage() {
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
                  Em preparação
                </span>
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Canal planejado para operar mensagens do Instagram Direct como
                uma inbox separada no Atendimento, com governança pelo CRM e
                integração futura com Leads e Vendas.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-[#374b89]/30 bg-white px-3 py-2 text-xs font-medium text-[#2f3453] shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-[#374b89]" />
            Canal isolado por inbox
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-[#374b89]" />
            <h2 className="text-lg font-bold text-[#2f3453]">
              Como funcionará
            </h2>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            O Instagram será uma entrada própria dentro do Atendimento. Cada
            organização terá sua conexão e sua inbox, sem compartilhar operação
            com outros canais.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-[#374b89]" />
            <h2 className="text-lg font-bold text-[#2f3453]">
              Multiagentes
            </h2>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            A distribuição de atendimento deve seguir a operação nativa do
            Atendimento, com agentes e equipes vinculados à inbox do Instagram.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#374b89]" />
            <h2 className="text-lg font-bold text-[#2f3453]">
              Valor comercial
            </h2>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            O canal poderá ser vendido como recurso de plano superior,
            fortalecendo o CRM como central multicanal para vendas e atendimento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">
            Projeto de implementação
          </h2>

          <div className="mt-5 space-y-4">
            {implementationSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#374b89] text-sm font-bold text-white">
                    {index + 1}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#2f3453]">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#2f3453]">
            Requisitos antes de ativar
          </h2>

          <div className="mt-5 space-y-3">
            {requirements.map((item) => (
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
              Status da implementação
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-700">
              Esta tela ainda não conecta com a Meta nem cria inbox. Ela apenas
              registra a trilha oficial do canal antes da implementação técnica.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}