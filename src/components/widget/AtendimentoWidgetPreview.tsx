'use client'

import { MessageCircle, X, Circle } from 'lucide-react'

type WidgetPosition = 'right' | 'left'
type OperatingMode = 'manual' | 'business_hours'
type FallbackBehavior = 'none' | 'redirect'
type ScenarioKey = 'default' | 'atendimento' | 'consultoria' | 'whatsapp' | 'contato'

type BusinessDay = {
  enabled: boolean
  start: string
  end: string
}

type BusinessHours = {
  monday: BusinessDay
  tuesday: BusinessDay
  wednesday: BusinessDay
  thursday: BusinessDay
  friday: BusinessDay
  saturday: BusinessDay
  sunday: BusinessDay
}

type ScenarioTarget = {
  label: string
  url: string
}

type ScenarioTargets = Record<ScenarioKey, ScenarioTarget>

type AtendimentoWidgetPreviewProps = {
  organizationName: string
  title: string
  subtitle: string
  ctaLabel: string
  online: boolean
  position: WidgetPosition
  buttonLabel: string
  primaryColor: string
  accentColor: string
  operatingMode: OperatingMode
  timezone: string
  fallbackBehavior: FallbackBehavior
  fallbackLabel: string
  fallbackUrl: string
  primaryActionUrl: string
  businessHours: BusinessHours
  scenarioTargets: ScenarioTargets
  previewContext: ScenarioKey
}

type ResolvedTarget = {
  label: string
  url: string
}

type ResolvedWidgetState = {
  online: boolean
  actionLabel: string
  actionUrl: string
  helperText: string
  statusText: string
}

const weekdayMap: Record<string, keyof BusinessHours> = {
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function isBusinessOpen({
  timezone,
  businessHours,
}: {
  timezone: string
  businessHours: BusinessHours
}) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date())
    const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase() ?? ''
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'

    const dayKey = weekdayMap[weekday]
    if (!dayKey) return false

    const day = businessHours[dayKey]
    if (!day.enabled) return false

    const currentMinutes = Number(hour) * 60 + Number(minute)
    return currentMinutes >= toMinutes(day.start) && currentMinutes <= toMinutes(day.end)
  } catch {
    return false
  }
}

function resolveScenarioTarget(params: {
  scenarioTargets: ScenarioTargets
  scenarioKey: ScenarioKey
  fallbackLabel: string
  fallbackUrl: string
}): ResolvedTarget {
  const selected = params.scenarioTargets[params.scenarioKey]
  const defaultTarget = params.scenarioTargets.default

  if (selected?.url?.trim()) {
    return {
      label: selected.label.trim() || params.fallbackLabel,
      url: selected.url.trim(),
    }
  }

  if (defaultTarget?.url?.trim()) {
    return {
      label: defaultTarget.label.trim() || params.fallbackLabel,
      url: defaultTarget.url.trim(),
    }
  }

  return {
    label: params.fallbackLabel,
    url: params.fallbackUrl,
  }
}

function resolveWidgetState(params: {
  operatingMode: OperatingMode
  online: boolean
  timezone: string
  businessHours: BusinessHours
  ctaLabel: string
  primaryActionUrl: string
  fallbackBehavior: FallbackBehavior
  fallbackLabel: string
  fallbackUrl: string
  scenarioTargets: ScenarioTargets
  scenarioKey: ScenarioKey
}): ResolvedWidgetState {
  const isOnline =
    params.operatingMode === 'manual'
      ? params.online
      : isBusinessOpen({
          timezone: params.timezone,
          businessHours: params.businessHours,
        })

  const onlineTarget = resolveScenarioTarget({
    scenarioTargets: params.scenarioTargets,
    scenarioKey: params.scenarioKey,
    fallbackLabel: params.ctaLabel,
    fallbackUrl: params.primaryActionUrl,
  })

  if (isOnline) {
    return {
      online: true,
      actionLabel: onlineTarget.label,
      actionUrl: onlineTarget.url,
      helperText:
        'Widget em modo operacional. O destino foi resolvido pelo contexto da página.',
      statusText: 'Atendimento disponível',
    }
  }

  if (params.fallbackBehavior === 'redirect' && params.fallbackUrl.trim()) {
    return {
      online: false,
      actionLabel: params.fallbackLabel.trim() || 'Abrir opção alternativa',
      actionUrl: params.fallbackUrl.trim(),
      helperText:
        'Fora do horário. O CTA foi governado para o fallback configurado.',
      statusText: 'Fora do horário',
    }
  }

  return {
    online: false,
    actionLabel: onlineTarget.label,
    actionUrl: onlineTarget.url,
    helperText:
      'Fora do horário. Sem fallback configurado, o destino do contexto foi mantido.',
    statusText: 'Fora do horário',
  }
}

export default function AtendimentoWidgetPreview(props: AtendimentoWidgetPreviewProps) {
  const resolved = resolveWidgetState({
    operatingMode: props.operatingMode,
    online: props.online,
    timezone: props.timezone,
    businessHours: props.businessHours,
    ctaLabel: props.ctaLabel,
    primaryActionUrl: props.primaryActionUrl,
    fallbackBehavior: props.fallbackBehavior,
    fallbackLabel: props.fallbackLabel,
    fallbackUrl: props.fallbackUrl,
    scenarioTargets: props.scenarioTargets,
    scenarioKey: props.previewContext,
  })

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#2f3453]">Preview do widget</h3>
          <p className="mt-1 text-sm text-slate-500">
            Prévia com contexto da página, horário, fallback e governança do CTA.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {resolved.online ? (
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
            Contexto atual
          </p>
          <p className="mt-2 text-sm font-semibold text-[#2f3453]">{props.previewContext}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            CTA resolvido
          </p>
          <p className="mt-2 text-sm font-semibold text-[#2f3453]">{resolved.actionLabel}</p>
        </div>
      </div>

      <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)] p-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Página do cliente
          </p>
          <h4 className="mt-2 text-xl font-bold text-[#2f3453]">{props.organizationName}</h4>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
            Área de simulação do widget. O objetivo aqui é validar contexto, CTA,
            fallback e destino por cenário sem tocar no motor do Atendimento.
          </p>
        </div>

        <div
          className={cn(
            'absolute bottom-6 flex w-[340px] max-w-[calc(100%-48px)] flex-col gap-3',
            props.position === 'right' ? 'right-6 items-end' : 'left-6 items-start'
          )}
        >
          <div className="w-full rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div
              className="flex items-start justify-between gap-3 rounded-t-3xl px-5 py-4 text-white"
              style={{ backgroundColor: props.accentColor }}
            >
              <div>
                <p className="text-sm font-semibold">{props.organizationName}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-200">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      resolved.online ? 'bg-emerald-400' : 'bg-yellow-400'
                    )}
                  />
                  {resolved.statusText}
                </div>
              </div>

              <button className="rounded-xl p-1 text-slate-200 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <h5 className="text-base font-bold text-[#2f3453]">{props.title}</h5>
                <p className="mt-1 text-sm leading-6 text-slate-600">{props.subtitle}</p>
              </div>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: props.primaryColor }}
              >
                <MessageCircle className="h-4 w-4" />
                {resolved.actionLabel}
              </button>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                {resolved.helperText}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                Destino atual: {resolved.actionUrl}
              </div>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-full px-5 py-4 text-sm font-semibold text-white shadow-lg"
            style={{ backgroundColor: props.primaryColor }}
          >
            <MessageCircle className="h-5 w-5" />
            {props.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}