import { NextRequest, NextResponse } from 'next/server'
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
  const payload = await req.json().catch(() => null)

  if (!payload) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  const result = await processWhatsAppCloudWebhook(payload)

  return NextResponse.json(result)
}