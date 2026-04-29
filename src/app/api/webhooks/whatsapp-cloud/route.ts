import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

  if (mode !== 'subscribe' || !verifyToken || !challenge) {
    return textResponse('Bad Request', 400)
  }

  const account = await prisma.connectedAccount.findFirst({
    where: {
      provider: 'whatsapp_cloud',
      isActive: true,
      data: {
        contains: `"verifyToken":"${verifyToken}"`,
      },
    },
    select: {
      id: true,
    },
  })

  if (!account) {
    return textResponse('Forbidden', 403)
  }

  return textResponse(challenge, 200)
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null)

  if (!payload) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  console.log('[WHATSAPP CLOUD WEBHOOK]', JSON.stringify(payload))

  return NextResponse.json({ success: true })
}