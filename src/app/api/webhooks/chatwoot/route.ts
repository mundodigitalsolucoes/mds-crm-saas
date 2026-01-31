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

  // Get first organization (for now, you can improve this later)
  const organization = await prisma.organization.findFirst()
  
  if (!organization) {
    console.error('No organization found. Please create an organization first.')
    return
  }

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
        organizationId: organization.id,
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
  }
}

async function handleMessageCreated(webhook: ChatwootWebhook) {
  const { conversation, message } = webhook.data
  
  // Find lead by conversation
  const lead = await prisma.lead.findFirst({
    where: {
      chatwootConversationId: conversation.id
    }
  })

  if (lead) {
    // Update lead activity
    await prisma.lead.update({
      where: { id: lead.id },
      data: { 
        updatedAt: new Date(),
        lastActivityAt: new Date()
      }
    })
  }
}

async function handleContactCreated(webhook: ChatwootWebhook) {
  const { contact } = webhook.data
  
  const organization = await prisma.organization.findFirst()
  
  if (!organization) {
    console.error('No organization found')
    return
  }

  // Check if contact already exists
  const existingLead = await prisma.lead.findFirst({
    where: {
      OR: [
        { chatwootContactId: contact.id },
        { email: contact.email }
      ]
    }
  })

  if (!existingLead) {
    await prisma.lead.create({
      data: {
        organizationId: organization.id,
        name: contact.name || 'Contato sem nome',
        email: contact.email,
        phone: contact.phone_number,
        source: 'chatwoot',
        status: 'new',
        chatwootContactId: contact.id,
        customFields: contact.custom_attributes || {},
      }
    })
  }
}

async function handleStatusChanged(webhook: ChatwootWebhook) {
  const { conversation } = webhook.data
  
  const lead = await prisma.lead.findFirst({
    where: {
      chatwootConversationId: conversation.id
    }
  })

  if (lead) {
    // Map Chatwoot status to lead status
    let status = lead.status
    if (conversation.status === 'resolved') {
      status = 'qualified'
    } else if (conversation.status === 'open') {
      status = 'contacted'
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { 
        status,
        updatedAt: new Date()
      }
    })
  }
}
