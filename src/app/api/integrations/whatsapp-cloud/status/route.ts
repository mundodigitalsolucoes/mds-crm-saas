import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function hasRequiredSetup(data: Record<string, unknown>) {
  return Boolean(
    typeof data.displayName === 'string' &&
      data.displayName.trim() &&
      typeof data.appId === 'string' &&
      data.appId.trim() &&
      typeof data.businessAccountId === 'string' &&
      data.businessAccountId.trim() &&
      typeof data.phoneNumberId === 'string' &&
      data.phoneNumberId.trim() &&
      typeof data.verifyToken === 'string' &&
      data.verifyToken.trim()
  )
}

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
    },
  })

  if (!organization) {
    return NextResponse.json(
      { error: 'Organização não encontrada.' },
      { status: 404 }
    )
  }

  const account = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: {
        provider: 'whatsapp_cloud',
        organizationId,
      },
    },
    select: {
      id: true,
      isActive: true,
      lastError: true,
      lastSyncAt: true,
      updatedAt: true,
      data: true,
    },
  })

  if (!account) {
    return NextResponse.json({
      provider: 'whatsapp_cloud',
      status: 'disconnected',
      configured: false,
      orgScope: organization,
      setup: null,
    })
  }

  const parsedData =
    safeJsonParse<Record<string, unknown>>(account.data) ?? {}

  const configured = hasRequiredSetup(parsedData)
  const status = !account.isActive
    ? 'disconnected'
    : configured
      ? 'configured'
      : 'pending_validation'

  return NextResponse.json({
    provider: 'whatsapp_cloud',
    status,
    configured,
    orgScope: organization,
    setup: {
      connectedAccountId: account.id,
      displayName:
        typeof parsedData.displayName === 'string' ? parsedData.displayName : '',
      appId: typeof parsedData.appId === 'string' ? parsedData.appId : '',
      businessAccountId:
        typeof parsedData.businessAccountId === 'string'
          ? parsedData.businessAccountId
          : '',
      phoneNumberId:
        typeof parsedData.phoneNumberId === 'string'
          ? parsedData.phoneNumberId
          : '',
      verifyToken:
        typeof parsedData.verifyToken === 'string' ? parsedData.verifyToken : '',
      hasAccessToken: true,
      lastError: account.lastError,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      updatedAt: account.updatedAt.toISOString(),
    },
  })
}