import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { chatwootApi, getChatwootCredentials } from '@/lib/chatwoot'

const bodySchema = z.object({
  instanceId: z.string().min(1, 'Informe o ID do canal.'),
})

type CloudMetadata = {
  provider?: string
  deletedFromCrmAt?: string
  archivedAt?: string
  lastChatwootInboxId?: number | null
}

function safeJsonParse(value: string | null): CloudMetadata {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value) as CloudMetadata
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function removeChatwootInbox(params: {
  organizationId: string
  instanceId: string
  chatwootInboxId: number | null
}) {
  const { organizationId, instanceId, chatwootInboxId } = params

  if (!chatwootInboxId) return

  const refs = await prisma.whatsappInstance.count({
    where: {
      organizationId,
      chatwootInboxId,
      id: { not: instanceId },
      status: { not: 'archived' },
    },
  })

  if (refs > 0) return

  const credentials = await getChatwootCredentials(organizationId)
  if (!credentials) return

  try {
    await chatwootApi(credentials, `/inboxes/${chatwootInboxId}`, {
      method: 'DELETE',
      timeoutMs: 10_000,
    })
  } catch (error) {
    console.warn('[WHATSAPP CLOUD DELETE] Falha ao remover inbox do Atendimento:', error)
  }
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const rawBody = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const instance = await prisma.whatsappInstance.findFirst({
    where: {
      id: parsed.data.instanceId,
      organizationId,
      NOT: { status: 'archived' },
    },
  })

  if (!instance) {
    return NextResponse.json({ error: 'Canal não encontrado.' }, { status: 404 })
  }

  const metadata = safeJsonParse(instance.metadata)

  if (metadata.provider !== 'whatsapp_cloud') {
    return NextResponse.json(
      { error: 'Esta rota remove apenas canais WhatsApp API Oficial.' },
      { status: 400 }
    )
  }

  await removeChatwootInbox({
    organizationId,
    instanceId: instance.id,
    chatwootInboxId: instance.chatwootInboxId,
  })

  const now = new Date()

  await prisma.whatsappInstance.update({
    where: { id: instance.id },
    data: {
      status: 'archived',
      isActive: false,
      chatwootInboxId: null,
      lastError: null,
      disconnectedAt: now,
      metadata: JSON.stringify({
        ...metadata,
        deletedFromCrmAt: now.toISOString(),
        archivedAt: now.toISOString(),
        lastChatwootInboxId: instance.chatwootInboxId ?? null,
      }),
    },
  })

  return NextResponse.json({
    success: true,
    instanceId: instance.id,
    instanceName: instance.instanceName,
  })
}
