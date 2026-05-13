// src/app/api/users/invite/route.ts
// API para convidar/criar membro na mesma organização
// Acesso: owner e admin apenas (via checkAdminAccess)
// Dispara email de boas-vindas com credenciais via Resend
// Após criar: provisiona usuário confirmado no Atendimento via Platform API

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAdminAccess } from '@/lib/checkPermission'
import { checkOrganizationLimit, checkPlanActive } from '@/lib/checkLimits'
import {
  getDefaultPermissions,
  serializePermissions,
} from '@/lib/permissions'
import { sendInviteEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { parseBody, userInviteSchema } from '@/lib/validations'
import { z } from 'zod'
import type { UserRole } from '@/types/permissions'
import {
  addChatwootTeamMembers,
  attachChatwootPlatformUserToAccount,
  createChatwootPlatformUser,
  getChatwootCredentials,
} from '@/lib/chatwoot'

const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  manager: 2,
  admin: 3,
  owner: 4,
}

function createTechnicalPassword(): string {
  return `${randomBytes(24).toString('base64url')}A1!`
}

async function syncAgentToChatwoot(params: {
  userId: string
  organizationId: string
  name: string
  email: string
  role: string
  chatwootTeamId?: number
}): Promise<void> {
  try {
    const credentials = await getChatwootCredentials(params.organizationId)

    if (!credentials) return

    const chatwootRole =
      params.role === 'owner' || params.role === 'admin'
        ? 'administrator'
        : 'agent'

    const platformUser = await createChatwootPlatformUser({
      chatwootUrl: credentials.chatwootUrl,
      name: params.name,
      email: params.email,
      password: createTechnicalPassword(),
      crmUserId: params.userId,
      organizationId: params.organizationId,
    })

    if (!platformUser.id) {
      console.warn('[CHATWOOT PLATFORM] Usuário criado sem ID:', platformUser)
      return
    }

    await attachChatwootPlatformUserToAccount({
      chatwootUrl: credentials.chatwootUrl,
      accountId: credentials.accountId,
      userId: platformUser.id,
      role: chatwootRole,
    })

    await prisma.user.update({
      where: { id: params.userId },
      data: {
        chatwootUserId: platformUser.id,
        isChatwootAgent: true,
      },
    })

    if (params.chatwootTeamId) {
      await addChatwootTeamMembers(
        credentials,
        params.chatwootTeamId,
        [platformUser.id]
      ).catch((error) => {
        console.warn('[CHATWOOT PLATFORM] Falha ao adicionar ao time:', error)
      })
    }
  } catch (error) {
    console.error('[CHATWOOT PLATFORM] Erro ao provisionar agente:', error)
  }
}

const inviteWithTeamSchema = userInviteSchema.extend({
  chatwootTeamId: z.number().int().positive().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { allowed, session, errorResponse } = await checkAdminAccess()
    if (!allowed) return errorResponse!

    const currentUserId = session!.user.id
    const currentRole = session!.user.role
    const organizationId = session!.user.organizationId

    const planCheck = await checkPlanActive(organizationId)
    if (!planCheck.active) return planCheck.errorResponse!

    const limitCheck = await checkOrganizationLimit(organizationId, 'users')
    if (!limitCheck.allowed) return limitCheck.errorResponse!

    const body = await request.json()
    const parsed = parseBody(inviteWithTeamSchema, body)
    if (!parsed.success) return parsed.response

    const data = parsed.data

    if (currentRole === 'admin' && data.role === 'admin') {
      return NextResponse.json(
        { error: 'Apenas o proprietário pode criar administradores' },
        { status: 403 }
      )
    }

    const currentPower = ROLE_HIERARCHY[currentRole] || 0
    const targetPower = ROLE_HIERARCHY[data.role] || 0

    if (targetPower >= currentPower && currentRole !== 'owner') {
      return NextResponse.json(
        { error: 'Não pode criar membro com cargo igual ou superior ao seu' },
        { status: 403 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está em uso no sistema' },
        { status: 400 }
      )
    }

    const defaultPermissions = getDefaultPermissions(data.role as UserRole)
    const permissionsJson = serializePermissions(defaultPermissions)
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashedPassword,
        role: data.role,
        organizationId,
        permissions: permissionsJson,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        createdAt: true,
      },
    })

    const [inviter, organization] = await Promise.all([
      prisma.user.findUnique({
        where: { id: currentUserId },
        select: { name: true },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
    ])

    sendInviteEmail({
      to: data.email,
      userName: newUser.name,
      password: data.password,
      role: data.role,
      invitedBy: inviter?.name || 'Um administrador',
      organizationName: organization?.name,
    }).catch((error) => {
      console.error('[API INVITE] Falha ao enviar email de convite:', error)
    })

    syncAgentToChatwoot({
      userId: newUser.id,
      organizationId,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      chatwootTeamId: data.chatwootTeamId,
    }).catch((error) => {
      console.error('[API INVITE] Falha no provisionamento Atendimento:', error)
    })

    return NextResponse.json({
      message: `Membro ${newUser.name} criado com sucesso! Email de boas-vindas enviado.`,
      user: newUser,
    })
  } catch (error) {
    console.error('[API INVITE] Erro ao convidar membro:', error)

    return NextResponse.json(
      { error: 'Erro interno ao criar membro' },
      { status: 500 }
    )
  }
}