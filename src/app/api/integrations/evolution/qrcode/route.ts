// src/app/api/integrations/evolution/qrcode/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import {
  getInstanceState,
  getQRCode,
  type EvolutionConnectionState,
} from '@/lib/integrations/evolutionClient'

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...(init?.headers ?? {}),
    },
  })
}

function normalizePendingState(state: EvolutionConnectionState) {
  if (state === 'not_found') return 'missing'
  if (state === 'unknown') return 'connecting'
  return state
}

export async function GET(req: NextRequest) {
  const { allowed, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const instanceName = req.nextUrl.searchParams.get('instance')
  const mode = req.nextUrl.searchParams.get('mode') ?? 'qr'

  if (!instanceName) {
    return noStoreJson({ error: 'instance obrigatório.' }, { status: 400 })
  }

  if (mode === 'status') {
    const state = await getInstanceState(instanceName)

    if (state === 'open') {
      return noStoreJson({
        connected: true,
        pending: false,
        state: 'open',
      })
    }

    if (state === 'not_found') {
      return noStoreJson(
        { error: 'Instância não encontrada na Evolution.' },
        { status: 404 }
      )
    }

    return noStoreJson({
      connected: false,
      pending: true,
      state: normalizePendingState(state),
    })
  }

  const qrData = await getQRCode(instanceName)

  if (!qrData) {
    return noStoreJson(
      { error: 'Instância não encontrada na Evolution.' },
      { status: 404 }
    )
  }

  if (qrData.connected) {
    return noStoreJson({
      connected: true,
      pending: false,
      state: 'open',
    })
  }

  if (qrData.base64) {
    return noStoreJson({
      connected: false,
      pending: true,
      state: qrData.state ?? 'connecting',
      qrcode: qrData.base64,
      code: qrData.code,
      count: qrData.count,
    })
  }

  const fallbackState = await getInstanceState(instanceName)

  if (fallbackState === 'open') {
    return noStoreJson({
      connected: true,
      pending: false,
      state: 'open',
    })
  }

  if (fallbackState === 'not_found') {
    return noStoreJson(
      { error: 'Instância não encontrada na Evolution.' },
      { status: 404 }
    )
  }

  return noStoreJson({
    connected: false,
    pending: true,
    state: normalizePendingState(fallbackState),
  })
}