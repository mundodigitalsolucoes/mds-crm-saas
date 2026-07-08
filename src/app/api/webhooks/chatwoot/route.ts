// src/app/api/webhooks/chatwoot/route.ts

import { NextRequest, NextResponse } from 'next/server'
import {
  processChatwootEvent,
} from '@/lib/atendimento/orchestration/chatwoot-events'
import {
  extractChatwootAccountId,
  resolveOrganizationIdForChatwootAccount,
  type ChatwootWebhookPayload,
} from '@/lib/atendimento/orchestration/lead-bridge'

const WEBHOOK_SECRET = process.env.CHATWOOT_WEBHOOK_SECRET

type ChatwootWebhookDebugPayload = ChatwootWebhookPayload & {
  account?: { id?: unknown }
}

function objectKeys(value: unknown): string[] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  return Object.keys(value)
}

function logChatwootWebhookDebug(payload: ChatwootWebhookPayload) {
  const debugPayload = payload as ChatwootWebhookDebugPayload

  console.log('[CHATWOOT WEBHOOK DEBUG]', {
    event: debugPayload.event,
    account_id: debugPayload.account_id,
    account: {
      id: debugPayload.account?.id,
    },
    inbox_id: debugPayload.inbox_id,
    inbox: {
      id: debugPayload.inbox?.id,
    },
    conversation: {
      id: debugPayload.conversation?.id,
    },
    contact: {
      id: debugPayload.contact?.id,
    },
    keys: {
      payload: Object.keys(payload),
      account: objectKeys(debugPayload.account),
      conversation: objectKeys(debugPayload.conversation),
      inbox: objectKeys(debugPayload.inbox),
      contact: objectKeys(debugPayload.contact),
    },
  })
}

function validateSecret(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[Chatwoot Webhook] CHATWOOT_WEBHOOK_SECRET não configurado.')
    return true
  }

  const querySecret = req.nextUrl.searchParams.get('secret')

  const headerSecret =
    req.headers.get('x-chatwoot-token') ??
    req.headers.get('x-webhook-token') ??
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  return (
    querySecret === WEBHOOK_SECRET ||
    headerSecret === WEBHOOK_SECRET
  )
}

export async function POST(req: NextRequest) {
  if (!validateSecret(req)) {
    console.warn('[Chatwoot Webhook] Secret invalido - requisicao rejeitada.')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: ChatwootWebhookPayload

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  logChatwootWebhookDebug(payload)

  console.log('[Chatwoot Webhook] Evento recebido:', payload.event)

  const accountId = extractChatwootAccountId(payload)

  if (!accountId) {
    console.error('[Chatwoot Webhook] account_id ausente ou invalido; evento ignorado com seguranca.')
    return NextResponse.json({ success: true, skipped: true, reason: 'missing_account_id' })
  }

  const organizationId = await resolveOrganizationIdForChatwootAccount(accountId)

  if (!organizationId) {
    console.error(
      '[Chatwoot Webhook] Organizacao nao encontrada para account_id; evento ignorado com seguranca:',
      accountId
    )
    return NextResponse.json({ success: true, skipped: true, reason: 'unmapped_account_id' })
  }

  processChatwootEvent(payload, organizationId).catch((err) =>
    console.error('[Chatwoot Webhook] Erro ao processar evento:', err)
  )

  return NextResponse.json({ success: true })
}