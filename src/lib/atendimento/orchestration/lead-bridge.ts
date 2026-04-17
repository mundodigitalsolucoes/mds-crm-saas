// src/lib/atendimento/orchestration/lead-bridge.ts

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notify'
import {
  channelLabel,
  getChatwootCredentialsByAccountId,
  normalizeChatwootChannel,
} from '@/lib/chatwoot'

export interface ChatwootContact {
  id: number
  name?: string
  email?: string
  phone_number?: string
  avatar_url?: string
  custom_attributes?: Record<string, unknown>
}

export interface ChatwootInbox {
  id: number
  name?: string
  channel_type?: string
}

export interface ChatwootAssignee {
  id: number
  name?: string
  email?: string
}

export interface ChatwootConversationPayload {
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

export interface ChatwootWebhookPayload {
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
  message_type?: string | number
  created_at?: string
  conversation?: ChatwootConversationPayload
  contact?: ChatwootContact
  sender?: ChatwootContact
}

export async function resolveOrganizationIdForChatwootAccount(
  accountId?: number
): Promise<string | null> {
  if (accountId) {
    const creds = await getChatwootCredentialsByAccountId(accountId)
    if (creds?.organizationId) return creds.organizationId
  }

  const fallback = await prisma.connectedAccount.findFirst({
    where: { provider: 'chatwoot', isActive: true },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' },
  })

  return fallback?.organizationId ?? null
}

export function extractConversationData(payload: ChatwootWebhookPayload) {
  const chatwootId = payload.id ?? payload.conversation?.id
  const accountId = payload.account_id ?? payload.conversation?.account_id
  const inboxId = payload.inbox_id ?? payload.conversation?.inbox_id
  const inboxName = payload.inbox?.name ?? payload.conversation?.inbox?.name

  const rawChannel =
    payload.channel ??
    payload.meta?.channel ??
    payload.conversation?.channel ??
    payload.conversation?.meta?.channel ??
    payload.inbox?.channel_type ??
    payload.conversation?.inbox?.channel_type

  const channel = normalizeChatwootChannel(rawChannel)
  const status = payload.status ?? payload.conversation?.status ?? 'open'
  const contact = payload.meta?.sender ?? payload.contact ?? payload.sender
  const assignee = payload.meta?.assignee ?? payload.conversation?.meta?.assignee

  return {
    chatwootId,
    accountId,
    inboxId,
    inboxName,
    channel,
    status,
    contact,
    assignee,
  }
}

export function isOutgoingOrActivity(
  messageType: string | number | undefined
): boolean {
  return (
    messageType === 1 ||
    messageType === '1' ||
    messageType === 'outgoing' ||
    messageType === 2 ||
    messageType === '2' ||
    messageType === 'activity'
  )
}

export async function upsertLeadFromChatwootContact(params: {
  organizationId: string
  contact: ChatwootContact
  chatwootConversationId: number
}): Promise<string | null> {
  const { organizationId, contact, chatwootConversationId } = params

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
      name: contact.name || 'Lead sem nome',
      email: contact.email || null,
      phone: contact.phone_number || null,
      source: 'chatwoot',
      status: 'new',
      chatwootContactId: contact.id,
      chatwootConversationId,
    },
    select: { id: true },
  })

  return newLead.id
}

export async function resolveCrmAssigneeId(
  organizationId: string,
  assignee?: ChatwootAssignee
): Promise<string | null> {
  if (!assignee?.email) return null

  const user = await prisma.user.findFirst({
    where: {
      organizationId,
      email: assignee.email,
      deletedAt: null,
    },
    select: { id: true },
  })

  return user?.id ?? null
}

export async function bridgeConversationCreated(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  const {
    chatwootId,
    accountId,
    inboxId,
    inboxName,
    channel,
    status,
    contact,
    assignee,
  } = extractConversationData(payload)

  if (!chatwootId || !inboxId) {
    console.warn('[Chatwoot] conversation_created sem dados essenciais', {
      chatwootId,
      accountId,
      inboxId,
    })
    return
  }

  const assigneeId = await resolveCrmAssigneeId(organizationId, assignee)

  const leadId = contact
    ? await upsertLeadFromChatwootContact({
        organizationId,
        contact,
        chatwootConversationId: chatwootId,
      })
    : null

  const conversation = await prisma.chatwootConversation.upsert({
    where: {
      organizationId_chatwootId: { organizationId, chatwootId },
    },
    create: {
      organizationId,
      chatwootId,
      chatwootAccountId: accountId ?? 0,
      chatwootInboxId: inboxId,
      chatwootContactId: contact?.id ?? 0,
      channel,
      inboxName: inboxName ?? null,
      status,
      chatwootAssigneeId: assignee?.id ?? null,
      assigneeId,
      contactName: contact?.name ?? null,
      contactPhone: contact?.phone_number ?? null,
      contactEmail: contact?.email ?? null,
      contactAvatarUrl: contact?.avatar_url ?? null,
      leadId,
      unreadCount: 1,
      lastMessageAt: new Date(),
    },
    update: {
      status,
      ...(accountId && { chatwootAccountId: accountId }),
      ...(inboxName && { inboxName }),
      ...(channel && { channel }),
      ...(assignee?.id !== undefined && { chatwootAssigneeId: assignee.id }),
      ...(assigneeId && { assigneeId }),
      ...(contact?.name && { contactName: contact.name }),
      ...(contact?.phone_number && { contactPhone: contact.phone_number }),
      ...(contact?.email && { contactEmail: contact.email }),
      ...(contact?.avatar_url && { contactAvatarUrl: contact.avatar_url }),
      ...(leadId && { leadId }),
    },
    select: { id: true },
  })

  const channelLbl = channelLabel(channel)
  const contactName = contact?.name ?? 'Contato desconhecido'

  if (assigneeId) {
    await createNotification({
      userId: assigneeId,
      type: 'chatwoot_conversation',
      title: 'Nova conversa recebida',
      message: `${contactName} iniciou uma conversa via ${channelLbl}`,
      entityType: 'chatwoot_conversation',
      entityId: conversation.id,
    })
  } else {
    const admins = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['owner', 'admin'] },
        deletedAt: null,
      },
      select: { id: true },
    })

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: 'chatwoot_conversation',
          title: 'Nova conversa recebida',
          message: `${contactName} iniciou uma conversa via ${channelLbl}`,
          entityType: 'chatwoot_conversation',
          entityId: conversation.id,
        })
      )
    )
  }

  console.log(
    `[Chatwoot] Conversa #${chatwootId} criada | canal: ${channel} | lead: ${leadId ?? 'novo'}`
  )
}

export async function bridgeConversationUpdated(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  const { chatwootId, inboxName, channel, status, contact, assignee } =
    extractConversationData(payload)

  if (!chatwootId) return

  const assigneeId = await resolveCrmAssigneeId(organizationId, assignee)

  await prisma.chatwootConversation.updateMany({
    where: { organizationId, chatwootId },
    data: {
      status,
      ...(inboxName && { inboxName }),
      ...(channel && { channel }),
      ...(assignee?.id !== undefined && { chatwootAssigneeId: assignee.id }),
      ...(assigneeId && { assigneeId }),
      ...(contact?.name && { contactName: contact.name }),
      ...(contact?.phone_number && { contactPhone: contact.phone_number }),
      ...(contact?.email && { contactEmail: contact.email }),
      ...(contact?.avatar_url && { contactAvatarUrl: contact.avatar_url }),
    },
  })

  console.log(`[Chatwoot] Conversa #${chatwootId} atualizada | status: ${status}`)
}

export async function bridgeIncomingMessage(
  payload: ChatwootWebhookPayload,
  organizationId: string
): Promise<void> {
  if (isOutgoingOrActivity(payload.message_type)) {
    console.log('[Chatwoot] message_created ignorado | type:', payload.message_type)
    return
  }

  const conversationId = payload.conversation?.id
  if (!conversationId) return

  const content = payload.content ?? ''
  const contactName = payload.contact?.name ?? payload.sender?.name ?? 'Contato'
  const now = new Date()

  const accountId = payload.account_id ?? payload.conversation?.account_id
  const inboxId = payload.conversation?.inbox_id
  const contact =
    payload.conversation?.meta?.sender ?? payload.contact ?? payload.sender

  const rawChannel =
    payload.conversation?.channel ??
    payload.conversation?.meta?.channel ??
    payload.conversation?.inbox?.channel_type

  const channel = normalizeChatwootChannel(rawChannel)
  const status = payload.conversation?.status ?? 'open'

  if (contact?.id) {
    await upsertLeadFromChatwootContact({
      organizationId,
      contact: contact as ChatwootContact,
      chatwootConversationId: conversationId,
    })
  }

  if (accountId && inboxId) {
    await prisma.chatwootConversation.upsert({
      where: {
        organizationId_chatwootId: {
          organizationId,
          chatwootId: conversationId,
        },
      },
      create: {
        organizationId,
        chatwootId: conversationId,
        chatwootAccountId: accountId,
        chatwootInboxId: inboxId,
        chatwootContactId: contact?.id ?? 0,
        channel,
        status,
        contactName: contact?.name ?? null,
        contactPhone: (contact as ChatwootContact)?.phone_number ?? null,
        contactEmail: (contact as ChatwootContact)?.email ?? null,
        contactAvatarUrl: (contact as ChatwootContact)?.avatar_url ?? null,
        lastMessage: content.slice(0, 255),
        lastMessageAt: now,
        unreadCount: 1,
      },
      update: {
        lastMessage: content.slice(0, 255),
        lastMessageAt: now,
        unreadCount: { increment: 1 },
      },
    })
  } else {
    await prisma.chatwootConversation.updateMany({
      where: { organizationId, chatwootId: conversationId },
      data: {
        lastMessage: content.slice(0, 255),
        lastMessageAt: now,
        unreadCount: { increment: 1 },
      },
    })
  }

  const conversation = await prisma.chatwootConversation.findFirst({
    where: { organizationId, chatwootId: conversationId },
    select: { id: true, assigneeId: true },
  })

  if (conversation?.assigneeId) {
    await createNotification({
      userId: conversation.assigneeId,
      type: 'chatwoot_message',
      title: 'Nova mensagem recebida',
      message: `${contactName}: ${content.slice(0, 100)}`,
      entityType: 'chatwoot_conversation',
      entityId: conversation.id,
    })
  }

  console.log(
    `[Chatwoot] Mensagem recebida na conversa #${conversationId} | type: ${payload.message_type}`
  )
}

export async function bridgeContactCreated(
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
      name: contact.name || 'Contato sem nome',
      email: contact.email || null,
      phone: contact.phone_number || null,
      source: 'chatwoot',
      status: 'new',
      chatwootContactId: contact.id,
    },
  })

  console.log(`[Chatwoot] Lead criado via contact_created | contactId: ${contact.id}`)
}