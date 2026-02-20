// src/app/api/integrations/whatsapp/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/integrations/crypto'
import { z } from 'zod'
import { parseBody } from '@/lib/validations'  // ← corrigido

const schema = z.object({
  serverUrl:    z.string().url('URL inválida'),
  instanceName: z.string().min(1, 'Nome da instância obrigatório'),
  apiKey:       z.string().min(1, 'API Key obrigatória'),
})

export async function POST(req: NextRequest) {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit')
  if (!allowed) return errorResponse!

  const body = await req.json()                          // ← corrigido
  const parsed = parseBody(schema, body)                 // ← corrigido
  if (!parsed.success) return parsed.response            // ← corrigido (.response, não .error)

  const { serverUrl, instanceName, apiKey } = parsed.data
  const organizationId = session!.user.organizationId

  try {
    const url = `${serverUrl.replace(/\/$/, '')}/instance/connectionState/${instanceName}`
    const res = await fetch(url, {
      headers: { apikey: apiKey },
      signal:  AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Credenciais inválidas. Verifique a URL, instância e API Key.' },
        { status: 422 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível conectar ao servidor Evolution API.' },
      { status: 422 }
    )
  }

  const accessTokenEnc = encryptToken(apiKey)

  await prisma.connectedAccount.upsert({
    where: {
      provider_organizationId: { provider: 'whatsapp', organizationId },
    },
    create: {
      provider:      'whatsapp',
      organizationId,
      connectedById: session!.user.id,
      accessTokenEnc,
      isActive:      true,
      data: JSON.stringify({
        serverUrl:    serverUrl.replace(/\/$/, ''),
        instanceName,
      }),
    },
    update: {
      accessTokenEnc,
      isActive:   true,
      lastError:  null,
      lastSyncAt: new Date(),
      data: JSON.stringify({
        serverUrl:    serverUrl.replace(/\/$/, ''),
        instanceName,
      }),
    },
  })

  return NextResponse.json({ success: true })
}
