// src/app/api/webhooks/asaas/route.ts
// Webhook Asaas — atualiza planStatus da Organization conforme eventos de pagamento

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncPlanLimits } from '@/lib/checkLimits'

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN

// Mapa de planos Asaas → planos internos
const PLAN_MAP: Record<string, string> = {
  starter:      'starter',
  professional: 'professional',
  enterprise:   'enterprise',
  pro:          'professional', // alias comum
}

function resolvePlan(raw?: string): string {
  if (!raw) return 'starter'
  return PLAN_MAP[raw.toLowerCase()] ?? 'starter'
}

export async function POST(req: NextRequest) {
  try {
    // ── Validação de token ──────────────────────────────────────────
    if (WEBHOOK_TOKEN) {
      const token =
        req.headers.get('asaas-access-token') ??
        req.headers.get('x-webhook-token')
      if (token !== WEBHOOK_TOKEN) {
        console.warn('[Asaas] Token inválido')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const event: string = body.event ?? ''
    const payment = body.payment ?? {}
    const subscription = body.subscription ?? payment.subscription ?? {}

    const asaasCustomerId: string | undefined =
      payment.customer ?? subscription.customer

    console.log(`[Asaas] Evento: ${event} | Cliente: ${asaasCustomerId}`)

    // ── Roteamento de eventos ───────────────────────────────────────
    switch (event) {

      // Pagamento confirmado → ativar plano
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        if (!asaasCustomerId) break

        const org = await prisma.organization.findFirst({
          where: { asaasCustomerId },
        })
        if (!org) {
          console.warn(`[Asaas] Org não encontrada para customer: ${asaasCustomerId}`)
          break
        }

        const planRaw: string | undefined =
          subscription.plan ?? payment.description ?? undefined
        const plan = resolvePlan(planRaw)

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            planStatus:    'active',
            plan,
            trialEndsAt:   null,
            subscriptionId: subscription.id ?? org.subscriptionId,
          },
        })

        // ✅ Sincroniza limites do plano (maxUsers, maxLeads, maxProjects, maxOs, maxGoals)
        await syncPlanLimits(org.id, plan)

        console.log(`[Asaas] ✅ Org ${org.id} ativada — plano: ${plan}`)
        break
      }

      // Pagamento vencido → suspender
      case 'PAYMENT_OVERDUE': {
        if (!asaasCustomerId) break

        await prisma.organization.updateMany({
          where: { asaasCustomerId },
          data:  { planStatus: 'past_due' },
        })

        console.log(`[Asaas] ⚠️ Org suspensa (past_due) — customer: ${asaasCustomerId}`)
        break
      }

      // Pagamento cancelado/estornado → cancelar
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED': {
        if (!asaasCustomerId) break

        await prisma.organization.updateMany({
          where: { asaasCustomerId },
          data:  { planStatus: 'cancelled' },
        })

        console.log(`[Asaas] ❌ Org cancelada — customer: ${asaasCustomerId}`)
        break
      }

      // Assinatura criada → registrar subscriptionId
      case 'SUBSCRIPTION_CREATED': {
        if (!asaasCustomerId || !subscription.id) break

        await prisma.organization.updateMany({
          where: { asaasCustomerId },
          data:  { subscriptionId: subscription.id },
        })

        console.log(`[Asaas] 📋 Subscription registrada: ${subscription.id}`)
        break
      }

      default:
        console.log(`[Asaas] Evento ignorado: ${event}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Asaas] Erro no webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}