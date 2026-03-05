// src/app/api/admin/orgs/[orgId]/provision-chatwoot/route.ts
//
// Rota de provisionamento MANUAL pelo Super Admin do CRM.
// Usada como fallback quando:
//   - CHATWOOT_SUPER_ADMIN_EMAIL não estava configurado no signup
//   - O provisionamento automático falhou (log no console)
//   - O admin quer re-provisionar uma org existente
//
// Acesso: apenas SuperAdmin (cookie admin-token) ou via script CLI
//
// Uso:
//   curl -X POST https://crm.mundodigitalsolucoes.com.br/api/admin/orgs/ORG_ID/provision-chatwoot \
//     -H "Cookie: admin-token=SEU_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"force": false}'
//
// Com force=true sobrescreve um ConnectedAccount já existente.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { provisionChatwootForOrg } from '@/lib/integrations/chatwoot-provision'

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'super-admin-secret-key',
)

// ─── Auth Super Admin ────────────────────────────────────────────────────────

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin-token')?.value
  if (!token) return false
  try {
    await jwtVerify(token, ADMIN_JWT_SECRET)
    return true
  } catch {
    return false
  }
}

// ─── POST /api/admin/orgs/[orgId]/provision-chatwoot ────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } },
) {
  if (!(await verifySuperAdmin(req))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { orgId } = params
  const body  = await req.json().catch(() => ({}))
  const force = Boolean(body?.force)

  // Buscar org + owner
  const org = await prisma.organization.findUnique({
    where:   { id: orgId },
    include: {
      users: {
        where:  { role: 'owner' },
        take:   1,
        select: { id: true, name: true, email: true },
      },
    },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  const owner = org.users[0]
  if (!owner) {
    return NextResponse.json({ error: 'Nenhum owner encontrado para esta org' }, { status: 422 })
  }

  // Verificar se já existe ConnectedAccount ativo (a menos que force=true)
  if (!force) {
    const existing = await prisma.connectedAccount.findUnique({
      where: {
        provider_organizationId: { provider: 'chatwoot', organizationId: orgId },
      },
    })
    if (existing?.isActive) {
      return NextResponse.json({
        error: 'Chatwoot já provisionado para esta org. Use force=true para re-provisionar.',
        chatwootAccountId: org.chatwootAccountId,
      }, { status: 409 })
    }
  }

  // ── Provisionar ─────────────────────────────────────────────────────────────
  // Senha temporária gerada — o owner pode redefini-la no Chatwoot depois.
  // O login no iframe usa SSO via api_access_token, não senha direta.
  const tempPassword = `Tmp@${crypto.randomUUID().slice(0, 8)}!`

  const result = await provisionChatwootForOrg({
    organizationId: orgId,
    orgName:        org.name,
    orgSlug:        org.slug,
    ownerUserId:    owner.id,
    ownerName:      owner.name,
    ownerEmail:     owner.email,
    ownerPassword:  tempPassword,
  })

  if (!result.success) {
    return NextResponse.json({
      error:   'Falha no provisionamento',
      details: result.error,
      hint:    getErrorHint(result.error),
    }, { status: 500 })
  }

  return NextResponse.json({
    success:           true,
    orgId,
    orgSlug:           org.slug,
    chatwootAccountId: result.chatwootAccountId,
    chatwootUserId:    result.chatwootUserId,
    message:           `Chatwoot Account #${result.chatwootAccountId} provisionada para ${org.name}`,
  })
}

// ─── GET: status de provisionamento ─────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } },
) {
  if (!(await verifySuperAdmin(req))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: params.orgId },
    select: { id: true, name: true, slug: true, chatwootAccountId: true },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  const connected = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'chatwoot', organizationId: params.orgId },
    },
    select: { isActive: true, lastSyncAt: true, lastError: true, createdAt: true },
  })

  return NextResponse.json({
    orgId:             org.id,
    orgName:           org.name,
    provisioned:       !!connected?.isActive,
    chatwootAccountId: org.chatwootAccountId,
    connectedAt:       connected?.createdAt ?? null,
    lastSync:          connected?.lastSyncAt ?? null,
    lastError:         connected?.lastError ?? null,
  })
}

// ─── Dicas de erro para o admin ─────────────────────────────────────────────

function getErrorHint(error?: string): string {
  const hints: Record<string, string> = {
    super_admin_not_configured:
      'Defina CHATWOOT_SUPER_ADMIN_EMAIL e CHATWOOT_SUPER_ADMIN_PASSWORD no Coolify.',
    super_admin_auth_failed:
      'Credenciais do super admin incorretas. Verifique no Chatwoot Super Admin console.',
    account_creation_failed:
      'Falha ao criar account no Chatwoot. Verifique se a instância está saudável.',
    user_creation_failed:
      'Falha ao criar usuário. O email pode já estar em uso em outra account do Chatwoot.',
    unexpected_error:
      'Erro inesperado. Consulte os logs do servidor.',
  }
  return hints[error ?? ''] ?? 'Sem dica disponível.'
}