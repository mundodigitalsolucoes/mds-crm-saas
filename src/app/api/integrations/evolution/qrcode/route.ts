// src/app/api/integrations/evolution/qrcode/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'

function getEvoConfig() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
  return { EVO_URL: url.replace(/\/$/, ''), EVO_KEY: key }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function GET(req: NextRequest) {
  const { allowed, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const { EVO_URL, EVO_KEY } = getEvoConfig()

  const instanceName = req.nextUrl.searchParams.get('instance')
  if (!instanceName) {
    return NextResponse.json({ error: 'instance obrigatório.' }, { status: 400 })
  }

  // ── Tenta até 5x com intervalo de 2s (total ~10s) para aguardar QR gerado ──
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(2_000)

    try {
      const res = await fetch(`${EVO_URL}/instance/connect/${instanceName}`, {
        headers: { apikey: EVO_KEY },
        signal:  AbortSignal.timeout(10_000),
      })

      // ✅ CORREÇÃO: !res.ok → continua tentando (instância ainda inicializando)
      if (!res.ok) {
        console.warn(`[EVO QRCODE] tentativa ${attempt + 1}: instância não pronta (${res.status}), aguardando...`)
        continue
      }

      const json = await res.json() as {
        base64?: string
        code?:   string
        count?:  number
      }

      // QR disponível → retorna imediatamente
      if (json.base64) {
        return NextResponse.json({
          connected: false,
          qrcode:    json.base64,
          code:      json.code,
          count:     json.count,
        })
      }

      // Sem QR → verifica se já está conectado
      const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
        headers: { apikey: EVO_KEY },
        signal:  AbortSignal.timeout(5_000),
      })

      if (stateRes.ok) {
        const stateJson = await stateRes.json() as { instance?: { state?: string } }
        if (stateJson?.instance?.state === 'open') {
          return NextResponse.json({ connected: true })
        }
      }

      // Sem QR e sem conexão → tenta de novo no próximo loop

    } catch (err) {
      console.error(`[EVO QRCODE] tentativa ${attempt + 1}:`, err)
      if (attempt === 4) {
        return NextResponse.json({ error: 'Erro ao buscar QR Code.' }, { status: 502 })
      }
    }
  }

  return NextResponse.json(
    { error: 'QR Code indisponível. Tente reconectar.' },
    { status: 422 }
  )
}
