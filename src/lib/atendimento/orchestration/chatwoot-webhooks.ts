import { chatwootApi, type ChatwootCredentials } from '@/lib/chatwoot'

const CHATWOOT_WEBHOOK_NAME = 'MDS CRM - Atendimento Webhook'

const CHATWOOT_WEBHOOK_SUBSCRIPTIONS = [
  'message_created',
  'conversation_created',
  'conversation_updated',
  'conversation_status_changed',
  'contact_created',
] as const

type ChatwootWebhookSubscription = (typeof CHATWOOT_WEBHOOK_SUBSCRIPTIONS)[number]

type ChatwootWebhook = {
  id: number
  url: string
  name?: string
  subscriptions?: string[]
  account_id?: number
}

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/$/, '') || null
}

function resolvePublicAppUrl() {
  const configuredUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.APP_URL) ||
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://crm.mundodigitalsolucoes.com.br'

  return configuredUrl
}

function buildChatwootWebhookUrl() {
  const baseUrl = resolvePublicAppUrl()
  const url = new URL('/api/webhooks/chatwoot', baseUrl)

  if (process.env.CHATWOOT_WEBHOOK_SECRET) {
    url.searchParams.set('secret', process.env.CHATWOOT_WEBHOOK_SECRET)
  }

  return url.toString()
}

function isMdsChatwootWebhook(webhook: ChatwootWebhook) {
  if (webhook.name === CHATWOOT_WEBHOOK_NAME) return true

  try {
    const url = new URL(webhook.url)
    return url.pathname === '/api/webhooks/chatwoot'
  } catch {
    return webhook.url.includes('/api/webhooks/chatwoot')
  }
}

function hasAllRequiredSubscriptions(webhook: ChatwootWebhook) {
  const subscriptions = new Set(webhook.subscriptions ?? [])
  return CHATWOOT_WEBHOOK_SUBSCRIPTIONS.every((event) => subscriptions.has(event))
}

function mergeSubscriptions(webhook: ChatwootWebhook): ChatwootWebhookSubscription[] {
  const current = webhook.subscriptions ?? []
  const merged = new Set<string>([...current, ...CHATWOOT_WEBHOOK_SUBSCRIPTIONS])

  return CHATWOOT_WEBHOOK_SUBSCRIPTIONS.filter((event) => merged.has(event))
}

export async function ensureChatwootWebhookForOrganization(credentials: ChatwootCredentials) {
  const webhookUrl = buildChatwootWebhookUrl()
  const webhooks = await chatwootApi<ChatwootWebhook[]>(credentials, '/webhooks', {
    method: 'GET',
    timeoutMs: 10_000,
  })

  const existingWebhook = webhooks.find(isMdsChatwootWebhook)

  if (existingWebhook) {
    const needsUpdate =
      existingWebhook.url !== webhookUrl ||
      existingWebhook.name !== CHATWOOT_WEBHOOK_NAME ||
      !hasAllRequiredSubscriptions(existingWebhook)

    if (!needsUpdate) {
      return existingWebhook
    }

    return chatwootApi<ChatwootWebhook>(credentials, `/webhooks/${existingWebhook.id}`, {
      method: 'PATCH',
      timeoutMs: 10_000,
      body: {
        url: webhookUrl,
        name: CHATWOOT_WEBHOOK_NAME,
        subscriptions: mergeSubscriptions(existingWebhook),
      },
    })
  }

  return chatwootApi<ChatwootWebhook>(credentials, '/webhooks', {
    method: 'POST',
    timeoutMs: 10_000,
    body: {
      url: webhookUrl,
      name: CHATWOOT_WEBHOOK_NAME,
      subscriptions: [...CHATWOOT_WEBHOOK_SUBSCRIPTIONS],
    },
  })
}
