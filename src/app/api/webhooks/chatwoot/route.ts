import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ChatwootWebhook } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const webhook: ChatwootWebhook = await req.json()

    console.log('Chatwoot webhook received:', webhook.event)

    // Handle different webhook events
    switch (webhook.event) {
      case 'conversation_created':
        await handleConversationCreated(webhook)
        break
      
      case 'message_created':
        await handleMessageCreated(webhook)
        break
      
      case 'contact_created':
        await handleContactCreated(webhook)
        break
      
      case 'conversation_status_changed':
        await handleStatusChanged(webhook)
        break
      
      default:
        console.log('Unhandled event:', webhook.event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleConversationCreated(webhook: ChatwootWebhook) {
  const { conversation, contact } = webhook.data

  // Check if lead already exists
  const existingLead = await prisma.lead.findFirst({
    where: {
      OR: [
        { chatwootContactId: contact.id },
        { email: contact.email }
      ]
    }
  })

  if (!existingLead) {
    // Create new lead from Chatwoot conversation
    await prisma.lead.create({
      data: {
        name: contact.name || 'Lead sem nome',
        email: contact.email,
        phone: contact.phone_number,
        source: 'chatwoot',
        status: 'new',
        chatwootContactId: contact.id,
        chatwootConversationId: conversation.id,
        customFields: contact.custom_attributes || {},
      }
    })

    console.log('New lead created from Chatwoot:', contact.name)
  } else {
    // Update existing lead with conversation ID
    await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        chatwootConversationId: conversation.id,
      }
    })

    console.log('Lead updated with conversation:', existingLead.name)
  }

  // Log activity
  const lead = await prisma.lead.findFirst({
    where: { chatwootContactId: contact.id }
  })

  if (lead) {
    await prisma.activity.create({
      data: {
        entityType: 'lead',
        entityId: lead.id,
        action: 'conversation_started',
        description: 'Nova conversa iniciada no Chatwoot',
        leadId: lead.id,
      }
    })
  }
}

async function handleMessageCreated(webhook: ChatwootWebhook) {
  const { message, conversation, contact } = webhook.data

  // Find lead by Chatwoot contact ID
  const lead = await prisma.lead.findFirst({
    where: { chatwootContactId: contact.id }
  })

  if (lead) {
    // Log message activity
    await prisma.activity.create({
      data: {
        entityType: 'lead',
        entityId: lead.id,
        action: 'message_received',
        description: `Mensagem: ${message.content.substring(0, 100)}...`,
        metadata: {
          messageId: message.id,
          messageType: message.message_type,
          sender: message.sender?.name
        },
        leadId: lead.id,
      }
    })
  }
}

async function handleContactCreated(webhook: ChatwootWebhook) {
  const contact = webhook.data

  // Check if lead already exists
  const existingLead = await prisma.lead.findFirst({
    where: {
      OR: [
        { chatwootContactId: contact.id },
        { email: contact.email }
      ]
    }
  })

  if (!existingLead) {
    // Create new lead
    await prisma.lead.create({
      data: {
        name: contact.name || 'Lead sem nome',
        email: contact.email,
        phone: contact.phone_number,
        source: 'chatwoot',
        status: 'new',
        chatwootContactId: contact.id,
        customFields: contact.custom_attributes || {},
      }
    })

    console.log('New lead created from contact:', contact.name)
  }
}

async function handleStatusChanged(webhook: ChatwootWebhook) {
  const { conversation } = webhook.data

  // Find lead by conversation ID
  const lead = await prisma.lead.findFirst({
    where: { chatwootConversationId: conversation.id }
  })

  if (lead) {
    // Map Chatwoot status to Lead status
    const statusMap: Record<string, string> = {
      'open': 'contacted',
      'resolved': 'qualified',
      'pending': 'contacted',
    }

    const newStatus = statusMap[conversation.status] || lead.status

    if (newStatus !== lead.status) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: newStatus }
      })

      // Log activity
      await prisma.activity.create({
        data: {
          entityType: 'lead',
          entityId: lead.id,
          action: 'status_changed',
          description: `Status alterado de ${lead.status} para ${newStatus}`,
          leadId: lead.id,
        }
      })
    }
  }
}
