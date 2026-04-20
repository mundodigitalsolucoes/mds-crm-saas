// src/app/api/atendimento/canais/providers/route.ts

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { listWhatsappProviders } from '@/lib/atendimento/providers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      maxWhatsappInstances: true,
    },
  })

  if (!organization) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      { status: 404 }
    )
  }

  const activeWhatsappInstances = await prisma.whatsappInstance.count({
    where: {
      organizationId,
      isActive: true,
      NOT: { status: 'archived' },
    },
  })

  return NextResponse.json({
    orgScope: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      activeWhatsappInstances,
      maxWhatsappInstances: organization.maxWhatsappInstances,
    },
    providers: listWhatsappProviders(),
  })
}