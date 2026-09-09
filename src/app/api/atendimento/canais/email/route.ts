import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/checkPermission'
import { checkPlanActive } from '@/lib/checkLimits'
import {
  connectGoogleWorkspaceEmail,
  deleteEmailChannel,
  listEmailChannels,
} from '@/lib/atendimento/providers/email'

const connectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do canal.')
    .max(60, 'O nome do canal deve ter no máximo 60 caracteres.'),
  email: z
    .string()
    .trim()
    .email('Informe um e-mail válido.')
    .max(254, 'Informe um e-mail válido.'),
  appPassword: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(
      z
        .string()
        .min(16, 'Informe a senha de app de 16 caracteres do Google.')
        .max(128, 'Senha de app inválida.')
    ),
})

const deleteSchema = z.object({
  inboxId: z.number().int().positive('Informe um canal válido.'),
})

function safeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback

  if (
    error.message === 'Atendimento não configurado para esta organização.' ||
    error.message === 'Este e-mail já possui um canal nesta organização.' ||
    error.message === 'Canal de e-mail não encontrado nesta organização.'
  ) {
    return error.message
  }

  return fallback
}

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'view'
  )
  if (!allowed) return errorResponse!

  try {
    const channels = await listEmailChannels(session!.user.organizationId)
    return NextResponse.json({ channels })
  } catch (error) {
    return NextResponse.json(
      {
        error: safeErrorMessage(
          error,
          'Não foi possível carregar os canais de e-mail.'
        ),
      },
      { status: 502 }
    )
  }
}

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'edit'
  )
  if (!allowed) return errorResponse!

  const planCheck = await checkPlanActive(session!.user.organizationId)
  if (!planCheck.active) return planCheck.errorResponse!

  const rawBody = await req.json().catch(() => null)
  const parsed = connectSchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  try {
    const channel = await connectGoogleWorkspaceEmail({
      organizationId: session!.user.organizationId,
      name: parsed.data.name,
      email: parsed.data.email,
      appPassword: parsed.data.appPassword,
    })

    return NextResponse.json({ success: true, channel })
  } catch (error) {
    const message = safeErrorMessage(
      error,
      'Não foi possível validar o IMAP/SMTP. Confira o e-mail, a senha de app e tente novamente.'
    )
    const status = message.includes('já possui') ? 409 : 502

    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission(
    'integrations',
    'delete'
  )
  if (!allowed) return errorResponse!

  const rawBody = await req.json().catch(() => null)
  const parsed = deleteSchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  try {
    await deleteEmailChannel({
      organizationId: session!.user.organizationId,
      inboxId: parsed.data.inboxId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = safeErrorMessage(
      error,
      'Não foi possível remover o canal de e-mail.'
    )
    const status = message.includes('não encontrado') ? 404 : 502

    return NextResponse.json({ error: message }, { status })
  }
}
