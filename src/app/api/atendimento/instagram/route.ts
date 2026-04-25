import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type InstagramConfig = {
  enabled: boolean
  instagramAccountName: string
  instagramHandle: string
  instagramBusinessId: string
  inboxName: string
  connectionMode: 'meta_api' | 'manual_token'
  status: 'draft' | 'pending_connection' | 'connected' | 'error'
  notes: string
}

const defaultConfig: InstagramConfig = {
  enabled: false,
  instagramAccountName: '',
  instagramHandle: '',
  instagramBusinessId: '',
  inboxName: 'Instagram Direct',
  connectionMode: 'meta_api',
  status: 'draft',
  notes: '',
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 }
    )
  }

  const orgScope = session.user.org

  if (!orgScope) {
    return NextResponse.json(
      { error: 'Organização não encontrada' },
      { status: 400 }
    )
  }

  // ⚠️ Simulação temporária (persistência futura via banco)
  const config = defaultConfig

  return NextResponse.json({
    orgScope,
    config,
    defaults: defaultConfig,
    savedAt: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 }
    )
  }

  const orgScope = session.user.org

  if (!orgScope) {
    return NextResponse.json(
      { error: 'Organização não encontrada' },
      { status: 400 }
    )
  }

  const body = await req.json()

  const config: InstagramConfig = {
    enabled: Boolean(body.enabled),
    instagramAccountName: body.instagramAccountName || '',
    instagramHandle: body.instagramHandle || '',
    instagramBusinessId: body.instagramBusinessId || '',
    inboxName: body.inboxName || 'Instagram Direct',
    connectionMode:
      body.connectionMode === 'manual_token'
        ? 'manual_token'
        : 'meta_api',
    status: body.status || 'draft',
    notes: body.notes || '',
  }

  // ⚠️ Aqui depois entra persistência real (Prisma)
  const savedAt = new Date().toISOString()

  return NextResponse.json({
    orgScope,
    config,
    defaults: defaultConfig,
    savedAt,
  })
}