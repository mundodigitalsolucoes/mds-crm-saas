import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'

function getEvoConfig() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
  return { EVO_URL: url.replace(/\/$/, ''), EVO_KEY: key }
}

export async function GET(req: NextRequest) {
  const { allowed, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const { EVO_URL, EVO_KEY } = getEvoConfig()

  const instanceName = req.nextUrl.searchParams.get('instance')
  if (!instanceName) {
    return NextResponse.json({ error: 'instance obrigatório.' }, { status: 400 })
  }

  try {
    // ── 1. Tenta buscar QR Code ────────────────────────────────────────────────
    const res = await fetch(`${EVO_URL}/instance/connect/${instanceName}`, {
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Instância não encontrada.' }, { status: 404 })
    }

    const json = await res.json() as {
      base64?: string
      code?:   string
      count?:  number
    }

    // ── 2. Se não veio base64, confirma estado real antes de declarar conectado
    if (!json.base64) {
      const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
        headers: { apikey: EVO_KEY },
        signal:  AbortSignal.timeout(5_000),
      })

      if (stateRes.ok) {
        const stateJson = await stateRes.json() as { instance?: { state?: string } }
        const isOpen    = stateJson?.instance?.state === 'open'

        if (isOpen) {
          return NextResponse.json({ connected: true })
        }
      }

      // Sem QR e sem conexão confirmada → instância em estado inválido
      return NextResponse.json(
        { error: 'QR Code indisponível. Tente reconectar.' },
        { status: 422 }
      )
    }

    // ── 3. Retorna QR Code ─────────────────────────────────────────────────────
    return NextResponse.json({
      connected: false,
      qrcode:    json.base64,
      code:      json.code,
      count:     json.count,
    })

  } catch (err) {
    console.error('[EVO QRCODE]', err)
    return NextResponse.json({ error: 'Erro ao buscar QR Code.' }, { status: 502 })
  }
}
