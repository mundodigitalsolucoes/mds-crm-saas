import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/integrations/crypto'

type PhoneNumberNode = {
  id: string
  verified_name?: string
  display_phone_number?: string
}

type GraphPhoneNumbersResponse = {
  data?: PhoneNumberNode[]
  error?: {
    message?: string
    type?: string
    code?: number
  }
}

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

async function persistValidationResult(params: {
  connectedAccountId: string
  previousData: Record<string, unknown>
  success: boolean
  message: string
  displayPhoneNumber?: string | null
  verifiedName?: string | null
}) {
  const now = new Date()

  await prisma.connectedAccount.update({
    where: { id: params.connectedAccountId },
    data: {
      lastError: params.success ? null : params.message,
      lastSyncAt: now,
      data: JSON.stringify({
        ...params.previousData,
        provider: 'whatsapp_cloud',
        status: params.success ? 'configured' : 'pending_validation',
        validation: {
          success: params.success,
          message: params.message,
          validatedAt: now.toISOString(),
          displayPhoneNumber: params.displayPhoneNumber ?? null,
          verifiedName: params.verifiedName ?? null,
        },
        updatedAt: now.toISOString(),
      }),
    },
  })
}

export async function POST() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId

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
      accessTokenEnc: true,
      data: true,
    },
  })

  if (!account || !account.isActive) {
    return NextResponse.json(
      {
        error: 'Nenhuma configuração ativa do WhatsApp Cloud API foi encontrada para esta organização.',
      },
      { status: 400 }
    )
  }

  const parsedData =
    safeJsonParse<Record<string, unknown>>(account.data) ?? {}

  if (!hasRequiredSetup(parsedData)) {
    return NextResponse.json(
      {
        error: 'A configuração está incompleta. Salve todos os campos obrigatórios antes de validar.',
      },
      { status: 400 }
    )
  }

  if (!account.accessTokenEnc) {
    return NextResponse.json(
      {
        error: 'Access Token não encontrado para esta organização.',
      },
      { status: 400 }
    )
  }

  const businessAccountId = String(parsedData.businessAccountId)
  const phoneNumberId = String(parsedData.phoneNumberId)

  let accessToken = ''

  try {
    accessToken = decryptToken(account.accessTokenEnc)
  } catch {
    await persistValidationResult({
      connectedAccountId: account.id,
      previousData: parsedData,
      success: false,
      message: 'Não foi possível descriptografar o Access Token salvo.',
    })

    return NextResponse.json(
      {
        error: 'Não foi possível descriptografar o Access Token salvo.',
      },
      { status: 500 }
    )
  }

  try {
    const graphVersion = 'v22.0'
    const url =
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(businessAccountId)}` +
      `/phone_numbers?fields=id,verified_name,display_phone_number`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })

    const rawText = await response.text()
    const payload = rawText
      ? (JSON.parse(rawText) as GraphPhoneNumbersResponse)
      : ({} as GraphPhoneNumbersResponse)

    if (!response.ok) {
      const errorMessage =
        payload.error?.message ??
        `Falha ao validar credenciais na API oficial (${response.status}).`

      await persistValidationResult({
        connectedAccountId: account.id,
        previousData: parsedData,
        success: false,
        message: errorMessage,
      })

      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 422 }
      )
    }

    const matchedPhone = (payload.data ?? []).find(
      (item) => item.id === phoneNumberId
    )

    if (!matchedPhone) {
      const errorMessage =
        'O Phone Number ID informado não foi encontrado dentro do Business Account ID configurado.'

      await persistValidationResult({
        connectedAccountId: account.id,
        previousData: parsedData,
        success: false,
        message: errorMessage,
      })

      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 422 }
      )
    }

    const successMessage =
      'Credenciais validadas com sucesso na API oficial.'

    await persistValidationResult({
      connectedAccountId: account.id,
      previousData: parsedData,
      success: true,
      message: successMessage,
      displayPhoneNumber: matchedPhone.display_phone_number ?? null,
      verifiedName: matchedPhone.verified_name ?? null,
    })

    return NextResponse.json({
      success: true,
      provider: 'whatsapp_cloud',
      status: 'configured',
      orgScope: {
        organizationId,
      },
      validation: {
        displayPhoneNumber: matchedPhone.display_phone_number ?? null,
        verifiedName: matchedPhone.verified_name ?? null,
        message: successMessage,
      },
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Erro inesperado ao validar credenciais do WhatsApp Cloud API.'

    await persistValidationResult({
      connectedAccountId: account.id,
      previousData: parsedData,
      success: false,
      message: errorMessage,
    })

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 502 }
    )
  }
}