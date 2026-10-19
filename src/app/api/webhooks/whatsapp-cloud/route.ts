import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { processWhatsAppCloudWebhook } from '@/lib/atendimento/providers/whatsapp-cloud-inbound'

export const dynamic = 'force-dynamic'

function textResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  const mode = searchParams.get('hub.mode')
  const verifyToken = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expectedVerifyToken = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN

  if (!expectedVerifyToken) {
    console.error('[WHATSAPP CLOUD WEBHOOK] Missing WHATSAPP_CLOUD_VERIFY_TOKEN')
    return textResponse('Server Misconfigured', 500)
  }

  if (mode !== 'subscribe' || !verifyToken || !challenge) {
    return textResponse('Bad Request', 400)
  }

  if (verifyToken !== expectedVerifyToken) {
    return textResponse('Forbidden', 403)
  }

  return textResponse(challenge, 200)
}

export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_CLOUD_APP_SECRET
  if (!secret) return NextResponse.json({ success: false }, { status: 503 })

  const signature = req.headers.get('x-hub-signature-256')
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const rawBody = await req.text()
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const received = Buffer.from(signature.slice(7), 'hex')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  let payload: unknown
  try { payload = JSON.parse(rawBody) } catch { payload = null }

  if (!payload) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  const result = await processWhatsAppCloudWebhook(payload)

  return NextResponse.json(result)
}