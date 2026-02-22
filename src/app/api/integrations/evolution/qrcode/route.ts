import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'

const EVO_URL = process.env.EVOLUTION_API_URL!.replace(/\/$/, '')
const EVO_KEY = process.env.EVOLUTION_API_KEY!

export async function GET(req: NextRequest) {
  const { allowed, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const instanceName = req.nextUrl.searchParams.get('instance')
  if (!instanceName) {
    return NextResponse.json({ error: 'instance obrigatório.' }, { status: 400 })
  }

  try {
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

    // Instância já conectada (sem QR)
    if (!json.base64) {
      return NextResponse.json({ connected: true })
    }

    return NextResponse.json({
      connected: false,
      qrcode:    json.base64, // data:image/png;base64,...
      code:      json.code,
      count:     json.count,
    })

  } catch (err) {
    console.error('[EVO QRCODE]', err)
    return NextResponse.json({ error: 'Erro ao buscar QR Code.' }, { status: 502 })
  }
}
