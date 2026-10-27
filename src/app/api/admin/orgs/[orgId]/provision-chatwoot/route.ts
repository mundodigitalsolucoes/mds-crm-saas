// Official recovery route. No force overwrite or provider-specific alternative.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { provisionChatwootForOrg, getChatwootProvisionStatus } from '@/lib/integrations/chatwoot-provision'
const headers = { 'Cache-Control': 'private, no-store' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const admin = await verifyAdminToken()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  let body: { force?: unknown; inspectionAcknowledged?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.force !== undefined && body.force !== false || body.inspectionAcknowledged !== undefined && typeof body.inspectionAcknowledged !== 'boolean' || Object.keys(body).some(key => !['force','inspectionAcknowledged'].includes(key))) return NextResponse.json({ error: 'Sobrescrita forçada não permitida' }, { status: 400 })
  const { orgId } = await params
  const org = await prisma.organization.findUnique({ where: { id: orgId }, include: { users: { where: { role: 'owner', deletedAt: null }, take: 2, select: { id: true, name: true, email: true } } } })
  if (!org || org.deletedAt) return NextResponse.json({ error: 'Organização indisponível' }, { status: 404 })
  if (org.users.length !== 1) return NextResponse.json({ error: 'Revisar proprietário da organização' }, { status: 422 })
  const before = await getChatwootProvisionStatus(orgId)
  if (before?.inspectionRequired && body.inspectionAcknowledged !== true) return NextResponse.json({ error: 'inspection_required', hint: 'Inspecione os vínculos CRM e Chatwoot antes de autorizar criação ou recuperação' }, { status: 409, headers })
  const owner = org.users[0]
  const result = await provisionChatwootForOrg({ organizationId: orgId, orgName: org.name, orgSlug: org.slug, ownerUserId: owner.id, ownerName: owner.name, ownerEmail: owner.email, allowCreate: body.inspectionAcknowledged === true, actorId: admin.id })
  const local = await getChatwootProvisionStatus(orgId)
  const onboarding = !result.success && local ? { ...local, provisioned: false, status: result.error === 'provisioning_in_progress' ? 'provisioning' : 'recovery_required', lastError: result.error } : local
  return NextResponse.json({ ...result, onboarding }, { status: result.success ? 200 : result.error === 'provisioning_in_progress' ? 202 : 409, headers })
}
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await verifyAdminToken())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { orgId } = await params
  const status = await getChatwootProvisionStatus(orgId)
  return NextResponse.json(status ?? { error: 'Organização indisponível' }, { status: status ? 200 : 404, headers })
}
