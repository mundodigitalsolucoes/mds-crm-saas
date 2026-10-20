import { prisma } from '@/lib/prisma'

type Binding = { organizationId: string; connectedAccountId: string; accountId: number; baseUrl: string }
export class WidgetBindingMismatch extends Error {}

export async function reserveWidgetInbox(binding: Binding, inboxId: number | null) {
  const inserted = await prisma.widgetInboxOperation.createMany({
    data: [{ ...binding, inboxId, status: inboxId ? 'remote_created' : 'reserved' }], skipDuplicates: true,
  })
  const operation = await prisma.widgetInboxOperation.findUniqueOrThrow({ where: { organizationId: binding.organizationId } })
  if (operation.accountId !== binding.accountId || operation.baseUrl !== binding.baseUrl || operation.connectedAccountId !== binding.connectedAccountId) {
    throw new WidgetBindingMismatch('WIDGET_OPERATION_BINDING_MISMATCH')
  }
  return { operation, created: inserted.count === 1 }
}

export async function beginWidgetCreation(operationId: string) {
  const claimed = await prisma.widgetInboxOperation.updateMany({ where: { operationId, status: 'reserved', inboxId: null, organization: { deletedAt: null } }, data: { status: 'pending' } })
  if (claimed.count !== 1) throw new Error('WIDGET_OPERATION_ALREADY_DISPATCHED')
}

export async function rememberWidgetInbox(operationId: string, inboxId: number) {
  const saved = await prisma.widgetInboxOperation.updateMany({ where: { operationId, OR: [{ inboxId: null }, { inboxId }] }, data: { inboxId, status: 'remote_created' } })
  if (saved.count !== 1) throw new Error('WIDGET_REMOTE_RESULT_NOT_RECORDED')
}

export async function retainUncertainWidgetCreation(operationId: string) {
  await prisma.widgetInboxOperation.updateMany({ where: { operationId, inboxId: null, status: 'pending' }, data: { status: 'remote_unknown' } })
}

export async function cancelUnsentWidgetReservation(operationId: string) {
  // Never remove a dispatched/uncertain operation, even when its settings CAS fails.
  await prisma.widgetInboxOperation.deleteMany({ where: { operationId, status: 'reserved', inboxId: null } })
}
