// src/app/api/webhooks/chatwoot/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notify'
import {
  getChatwootCredentialsByAccountId,
  normalizeChatwootChannel,
} from '@/lib/chatwoot'
import { Prisma } from '@prisma/client'

// ─── Tipos do payload Chatwoot ────────────────────────────────────────────────

interface ChatwootContact {
  id: number
  name?: string
  email?: string
  phone_number?: string
  avatar_url?: string
  custom_attributes?: Record<string, unknown>
}

interface ChatwootInbox {
  id: number
  name?: string
  channel_type?: string
}

interface ChatwootAssignee {
  id: number
  name?: string
  email?: string
}

interface ChatwootConversationPayload {
  id: number
  account_id?: number
  inbox_id: number
  status: string
  channel?: string
  contact_inbox?: { contact_id?: number }
  meta?: {
    sender?: ChatwootContact
    assignee?: ChatwootAssignee
    channel?: string
  }
  inbox?: ChatwootInbox
}

interface ChatwootMessagePayload {
  id: number
  content?: string
  message_type: string | number
  created_at: string
  account_id?: number
  conversation?: ChatwootConversationPayload
  sender?: ChatwootContact
  contact?: ChatwootContact
}

interface ChatwootWebhookPayload {
  event: string
  account_id?: number
  id?: number
  status?: string
  channel?: string
  inbox_id?: number
  inbox?: ChatwootInbox
  meta?: {
    sender?: ChatwootContact
    assignee?: ChatwootAssignee
    channel?: string
  }
  content?: string
  message_type?: string | number  // ← corrigido: número ou string
  created_at?: string
  conversation?: ChatwootConversationPayload
  contact?: ChatwootContact
  sender?: ChatwootContact
}

// ─── Segredo do webhook ───────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.CHATWOOT_WEBHOOK_SECRET

function validateSecret(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[Chatwoot Webhook] CHATWOOT_WEBHOOK_SECRET não configurado.')
    return true
  }
  const secret = req.nextUrl.searchParams.get('secret')
  return secret === WEBHOOK_SECRET
}

// ─── Handler principal ────────────────────────────────────────────────────────

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

  console.log('[Chatwoot Webhook] Evento recebido:', payload.event)

  const accountId =
    payload.account_id ??
    payload.conversation?.account_id ??
    undefined

  let organizationId: string | null = null

  if (accountId) {
    const creds = await getChatwootCredentialsByAccountId(accountId)
    organizationId = creds?.organizationId ?? null
  }

  if (!organizationId) {
    const fallback = await prisma.connectedAccount.findFirst({
      where: { provider: 'chatwoot', isActive: true },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    })
    organizationId = fallback?.organizationId ?? null
  }

  if (!organizationId) {
    console.error('[Chatwoot Webhook] Organizacao nao encontrada para account_id:', accountId)
    return NextResponse.json({ success: true, skipped: true })
  }

  processEvent(payload, organizationId).catch((err) =>
    console.error('[Chatwoot Webhook] Erro ao processar evento:', err)
  )

  return NextResponse.json({ success: true })
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function processEvent(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  switch (payload.event) {
    case 'conversation_created':
      await handleConversationCreated(payload, organizationId)
      break
    case 'conversation_updated':
    case 'conversation_status_changed':
      await handleConversationUpdated(payload, organizationId)
      break
    case 'message_created':
      await handleMessageCreated(payload, organizationId)
      break
    case 'contact_created':
      await handleContactCreated(payload, organizationId)
      break
    default:
      console.log('[Chatwoot Webhook] Evento nao tratado:', payload.event)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractConversationData(payload: ChatwootWebhookPayload) {
  const chatwootId = payload.id ?? payload.conversation?.id
  const accountId  = payload.account_id ?? payload.conversation?.account_id
  const inboxId    = payload.inbox_id ?? payload.conversation?.inbox_id
  const inboxName  = payload.inbox?.name ?? payload.conversation?.inbox?.name
  const rawChannel =
    payload.channel ??
    payload.meta?.channel ??
    payload.conversation?.channel ??
    payload.conversation?.meta?.channel ??
    payload.inbox?.channel_type ??
    payload.conversation?.inbox?.channel_type
  const channel  = normalizeChatwootChannel(rawChannel)
  const status   = payload.status ?? payload.conversation?.status ?? 'open'
  const contact  = payload.meta?.sender ?? payload.contact ?? payload.sender
  const assignee = payload.meta?.assignee ?? payload.conversation?.meta?.assignee

  return { chatwootId, accountId, inboxId, inboxName, channel, status, contact, assignee }
}

function isOutgoingOrActivity(messageType: string | number | undefined): boolean {
  // Chatwoot envia message_type como número (0=incoming, 1=outgoing, 2=activity)
  // ou como string em algumas versões ("incoming", "outgoing", "activity")
  return (
    messageType === 1 ||
    messageType === '1' ||
    messageType === 'outgoing' ||
    messageType === 2 ||
    messageType === '2' ||
    messageType === 'activity'
  )
}

async function findOrCreateLead(
  organizationId: string,
  contact: ChatwootContact,
  chatwootConversationId: number
): Promise<string | null> {
  if (!contact) return null

  const orConditions: Prisma.LeadWhereInput[] = [
    { organizationId, chatwootContactId: contact.id },
  ]
  if (contact.email) {
    orConditions.push({ organizationId, email: contact.email })
  }
  if (contact.phone_number) {
    orConditions.push({ organizationId, phone: contact.phone_number })
  }

  const existingLead = await prisma.lead.findFirst({
    where: { OR: orConditions },
    select: { id: true },
  })

  if (existingLead) {
    await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        chatwootContactId: contact.id,
        chatwootConversationId,
      },
    })
    return existingLead.id
  }

  const newLead = await prisma.lead.create({
    data: {
      organizationId,
      name:                  contact.name || 'Lead sem nome',
      email:                 contact.email || null,
      phone:                 contact.phone_number || null,
      source:                'chatwoot',
      status:                'new',
      chatwootContactId:     contact.id,
      chatwootConversationId,
    },
    select: { id: true },
  })

  return newLead.id
}

async function resolveAssigneeId(
  organizationId: string,
  assignee?: ChatwootAssignee
): Promise<string | null> {
  if (!assignee?.email) return null
  const user = await prisma.user.findFirst({
    where: { organizationId, email: assignee.email, deletedAt: null },
    select: { id: true },
  })
  return user?.id ?? null
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleConversationCreated(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  const {
    chatwootId, accountId, inboxId, inboxName,
    channel, status, contact, assignee,
  } = extractConversationData(payload)

  if (!chatwootId || !accountId || !inboxId) {
    console.warn('[Chatwoot] conversation_created sem dados essenciais', { chatwootId, accountId, inboxId })
    return
  }

  const assigneeId = await resolveAssigneeId(organizationId, assignee)

  const leadId = contact
    ? await findOrCreateLead(organizationId, contact, chatwootId)
    : null

  const conv = await prisma.chatwootConversation.upsert({
    where: {
      organizationId_chatwootId: { organizationId, chatwootId },
    },
    create: {
      organizationId,
      chatwootId,
      chatwootAccountId:  accountId,
      chatwootInboxId:    inboxId,
      chatwootContactId:  contact?.id ?? 0,
      channel,
      inboxName:          inboxName ?? null,
      status,
      chatwootAssigneeId: assignee?.id ?? null,
      assigneeId,
      contactName:        contact?.name ?? null,
      contactPhone:       contact?.phone_number ?? null,
      contactEmail:       contact?.email ?? null,
      contactAvatarUrl:   contact?.avatar_url ?? null,
      leadId,
      unreadCount:        1,
      lastMessageAt:      new Date(),
    },
    update: {
      status,
      ...(inboxName                  && { inboxName }),
      ...(channel                    && { channel }),
      ...(assignee?.id !== undefined && { chatwootAssigneeId: assignee.id }),
      ...(assigneeId                 && { assigneeId }),
      ...(contact?.name              && { contactName:      contact.name }),
      ...(contact?.phone_number      && { contactPhone:     contact.phone_number }),
      ...(contact?.email             && { contactEmail:     contact.email }),
      ...(contact?.avatar_url        && { contactAvatarUrl: contact.avatar_url }),
      ...(leadId                     && { leadId }),
    },
    select: { id: true },
  })

  const channelLbl  = getChannelLabel(channel)
  const contactName = contact?.name ?? 'Contato desconhecido'

  if (assigneeId) {
    await createNotification({
      userId:     assigneeId,
      type:       'chatwoot_conversation',
      title:      'Nova conversa recebida',
      message:    contactName + ' iniciou uma conversa via ' + channelLbl,
      entityType: 'chatwoot_conversation',
      entityId:   conv.id,
    })
  } else {
    const admins = await prisma.user.findMany({
      where: {
        organizationId,
        role:      { in: ['owner', 'admin'] },
        deletedAt: null,
      },
      select: { id: true },
    })
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId:     admin.id,
          type:       'chatwoot_conversation',
          title:      'Nova conversa recebida',
          message:    contactName + ' iniciou uma conversa via ' + channelLbl,
          entityType: 'chatwoot_conversation',
          entityId:   conv.id,
        })
      )
    )
  }

  console.log('[Chatwoot] Conversa #' + chatwootId + ' criada | canal: ' + channel + ' | lead: ' + (leadId ?? 'novo'))
}

async function handleConversationUpdated(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  const { chatwootId, inboxName, channel, status, contact, assignee } =
    extractConversationData(payload)

  if (!chatwootId) return

  const assigneeId = await resolveAssigneeId(organizationId, assignee)

  await prisma.chatwootConversation.updateMany({
    where: { organizationId, chatwootId },
    data: {
      status,
      ...(inboxName                  && { inboxName }),
      ...(channel                    && { channel }),
      ...(assignee?.id !== undefined && { chatwootAssigneeId: assignee.id }),
      ...(assigneeId                 && { assigneeId }),
      ...(contact?.name              && { contactName:      contact.name }),
      ...(contact?.phone_number      && { contactPhone:     contact.phone_number }),
      ...(contact?.email             && { contactEmail:     contact.email }),
      ...(contact?.avatar_url        && { contactAvatarUrl: contact.avatar_url }),
    },
  })

  console.log('[Chatwoot] Conversa #' + chatwootId + ' atualizada | status: ' + status)
}

async function handleMessageCreated(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  // Ignora mensagens enviadas (outgoing) e atividades do sistema
  if (isOutgoingOrActivity(payload.message_type)) {
    console.log('[Chatwoot] message_created ignorado | type:', payload.message_type)
    return
  }

  const conversationId = payload.conversation?.id
  if (!conversationId) return

  const content  = payload.content ?? ''
  const contactN = payload.contact?.name ?? payload.sender?.name ?? 'Contato'
  const now      = new Date()

  // Extrai dados para upsert caso a conversa não exista no cache
  const accountId = payload.account_id ?? payload.conversation?.account_id
  const inboxId   = payload.conversation?.inbox_id
  const contact   = payload.conversation?.meta?.sender ?? payload.contact ?? payload.sender
  const rawChannel =
    payload.conversation?.channel ??
    payload.conversation?.meta?.channel ??
    payload.conversation?.inbox?.channel_type
  const channel = normalizeChatwootChannel(rawChannel)
  const status  = payload.conversation?.status ?? 'open'

  // Garante que o Lead existe
  if (contact?.id) {
    await findOrCreateLead(organizationId, contact as ChatwootContact, conversationId)
  }

  if (accountId && inboxId) {
    // Upsert: cria a conversa no cache se ainda não existir
    await prisma.chatwootConversation.upsert({
      where: {
        organizationId_chatwootId: { organizationId, chatwootId: conversationId },
      },
      create: {
        organizationId,
        chatwootId:        conversationId,
        chatwootAccountId: accountId,
        chatwootInboxId:   inboxId,
        chatwootContactId: contact?.id ?? 0,
        channel,
        status,
        contactName:       contact?.name ?? null,
        contactPhone:      (contact as ChatwootContact)?.phone_number ?? null,
        contactEmail:      (contact as ChatwootContact)?.email ?? null,
        contactAvatarUrl:  (contact as ChatwootContact)?.avatar_url ?? null,
        lastMessage:       content.slice(0, 255),
        lastMessageAt:     now,
        unreadCount:       1,
      },
      update: {
        lastMessage:   content.slice(0, 255),
        lastMessageAt: now,
        unreadCount:   { increment: 1 },
      },
    })
  } else {
    // Fallback: só atualiza se já existir
    await prisma.chatwootConversation.updateMany({
      where: { organizationId, chatwootId: conversationId },
      data: {
        lastMessage:   content.slice(0, 255),
        lastMessageAt: now,
        unreadCount:   { increment: 1 },
      },
    })
  }

  // Notifica o agente responsável
  const conv = await prisma.chatwootConversation.findFirst({
    where: { organizationId, chatwootId: conversationId },
    select: { id: true, assigneeId: true },
  })

  if (conv?.assigneeId) {
    await createNotification({
      userId:     conv.assigneeId,
      type:       'chatwoot_message',
      title:      'Nova mensagem recebida',
      message:    contactN + ': ' + content.slice(0, 100),
      entityType: 'chatwoot_conversation',
      entityId:   conv.id,
    })
  }

  console.log('[Chatwoot] Mensagem recebida na conversa #' + conversationId + ' | type:', payload.message_type)
}

async function handleContactCreated(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  const contact = payload.contact

  if (!contact?.id) return

  const orConditions: Prisma.LeadWhereInput[] = [
    { organizationId, chatwootContactId: contact.id },
  ]
  if (contact.email) {
    orConditions.push({ organizationId, email: contact.email })
  }

  const existing = await prisma.lead.findFirst({
    where: { OR: orConditions },
    select: { id: true },
  })

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: { chatwootContactId: contact.id },
    })
    return
  }

  await prisma.lead.create({
    data: {
      organizationId,
      name:              contact.name || 'Contato sem nome',
      email:             contact.email || null,
      phone:             contact.phone_number || null,
      source:            'chatwoot',
      status:            'new',
      chatwootContactId: contact.id,
    },
  })

  console.log('[Chatwoot] Lead criado via contact_created | contactId: ' + contact.id)
}

// ─── Util local ───────────────────────────────────────────────────────────────

function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    whatsapp:   'WhatsApp',
    email:      'Email',
    web_widget: 'Widget Web',
    instagram:  'Instagram',
    facebook:   'Facebook',
    telegram:   'Telegram',
  }
  return labels[channel] ?? channel
}
