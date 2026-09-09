import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { checkPlanActive } from '@/lib/checkLimits'
import { getGoogleEmailAuthorizationUrl } from '@/lib/atendimento/providers/email'

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'edit'
  )
  if (!allowed) return errorResponse!

  const planCheck = await checkPlanActive(session!.user.organizationId)
  if (!planCheck.active) return planCheck.errorResponse!

  try {
    const url = await getGoogleEmailAuthorizationUrl(
      session!.user.organizationId
    )
    return NextResponse.json({ url })
  } catch (error) {
    const message =
      error instanceof Error &&
      (error.message === 'Atendimento não configurado para esta organização.' ||
        error.message === 'A conexão com o Google ainda não está configurada.')
        ? error.message
        : 'Não foi possível iniciar a conexão segura com o Google.'

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
