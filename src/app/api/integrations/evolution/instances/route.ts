/**
 * src/app/api/integrations/evolution/instances/route.ts
 *
 * Lista as instâncias WhatsApp da organização para a UI de Integrações.
 * Leitura fina: sem sincronização pesada dentro da rota.
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { listWhatsappInstancesWithRuntime } from '@/lib/atendimento/orchestration/channel-status'

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true,
      maxWhatsappInstances: true,
    },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
  }

  const instances = await listWhatsappInstancesWithRuntime(organizationId)

  const activeCount = instances.filter((item) => item.isActive).length
  const isUnlimited = org.maxWhatsappInstances <= 0

  return NextResponse.json({
    plan: org.plan,
    usage: {
      current: activeCount,
      max: org.maxWhatsappInstances,
      isUnlimited,
      canAddMore: isUnlimited || activeCount < org.maxWhatsappInstances,
    },
    instances: instances.map(
      ({
        rawState: _rawState,
        effectiveState: _effectiveState,
        inGraceWindow: _inGraceWindow,
        ...item
      }) => item
    ),
  })
}