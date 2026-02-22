import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'

const EVO_URL = process.env.EVOLUTION_API_URL!.replace(/\/$/, '')
const EVO_KEY = process.env.EVOLUTION_API_KEY!

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

  const account = await prisma.connectedAccount.findUnique({
    where:  { provider_organizationId: { provider: 'whatsapp', organizationId } },
    select: { data: true },
  })

  if (!account) {
    return NextResponse.json({ success: true }) // já desconectado
  }

  const data = JSON.parse(account.data) as { instanceName: string }

  // ── Desconecta e deleta instância na Evolution API ───────────────────────────
  try {
    // 1. Logout (desconecta WhatsApp)
    await fetch(`${EVO_URL}/instance/logout/${data.instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
  } catch {
    // Silencioso — pode já estar desconectado
  }

  try {
    // 2. Deleta instância
    await fetch(`${EVO_URL}/instance/delete/${data.instanceName}`, {
      method:  'DELETE',
      headers: { apikey: EVO_KEY },
      signal:  AbortSignal.timeout(8_000),
    })
  } catch {
    // Silencioso
  }

  // ── Desativa no banco ────────────────────────────────────────────────────────
  await prisma.connectedAccount.updateMany({
    where: { provider: 'whatsapp', organizationId },
    data:  { isActive: false, lastError: null },
  })

  return NextResponse.json({ success: true })
}
