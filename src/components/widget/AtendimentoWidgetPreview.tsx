'use client'

import { MessageCircle, X, Circle } from 'lucide-react'

type AtendimentoWidgetPreviewProps = {
  organizationName: string
  title: string
  subtitle: string
  ctaLabel: string
  online: boolean
  position: 'right' | 'left'
  buttonLabel: string
  primaryColor: string
  accentColor: string
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function AtendimentoWidgetPreview({
  organizationName,
  title,
  subtitle,
  ctaLabel,
  online,
  position,
  buttonLabel,
  primaryColor,
  accentColor,
}: AtendimentoWidgetPreviewProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#2f3453]">Preview do widget</h3>
          <p className="mt-1 text-sm text-slate-500">
            Prévia visual local. O loader real já existe nesta fase, mas esta caixa ainda é só
            preview.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {online ? (
            <>
              <Circle className="h-3 w-3 fill-emerald-500 text-emerald-500" />
              Online
            </>
          ) : (
            <>
              <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              Offline
            </>
          )}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cor principal
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-6 w-6 rounded-full border border-slate-200"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-sm font-semibold text-[#2f3453]">{primaryColor}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cor de destaque
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-6 w-6 rounded-full border border-slate-200"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-sm font-semibold text-[#2f3453]">{accentColor}</span>
          </div>
        </div>
      </div>

      <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)] p-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Página do cliente
          </p>
          <h4 className="mt-2 text-xl font-bold text-[#2f3453]">{organizationName}</h4>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
            Área de simulação do widget. O objetivo aqui é validar casca visual, identidade,
            CTA e posicionamento sem tocar no motor do Atendimento.
          </p>
        </div>

        <div
          className={cn(
            'absolute bottom-6 flex w-[340px] max-w-[calc(100%-48px)] flex-col gap-3',
            position === 'right' ? 'right-6 items-end' : 'left-6 items-start'
          )}
        >
          <div className="w-full rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div
              className="flex items-start justify-between gap-3 rounded-t-3xl px-5 py-4 text-white"
              style={{ backgroundColor: accentColor }}
            >
              <div>
                <p className="text-sm font-semibold">{organizationName}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-200">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      online ? 'bg-emerald-400' : 'bg-yellow-400'
                    )}
                  />
                  {online ? 'Atendimento disponível' : 'Retorno no próximo horário'}
                </div>
              </div>

              <button className="rounded-xl p-1 text-slate-200 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <h5 className="text-base font-bold text-[#2f3453]">{title}</h5>
                <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
              </div>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <MessageCircle className="h-4 w-4" />
                {ctaLabel}
              </button>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                O widget real agora já pode ser carregado por snippet, mas a conversa operacional
                continua no Atendimento.
              </div>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-full px-5 py-4 text-sm font-semibold text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageCircle className="h-5 w-5" />
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}