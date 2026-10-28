// src/app/api/admin/users/[id]/route.ts
// API Admin — Atualização e Exclusão de Usuário
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { parseBody, adminUserUpdateSchema } from '@/lib/validations';
import {
  invalidateChatwootUserSessions,
  invalidateSingleChatwootUserSession,
} from '@/lib/integrations/chatwoot-cleanup';

type ChatwootAccountData = {
  chatwootUserId?: number;
  chatwootAccountId?: number;
  ownerEmail?: string;
  ownerPasswordEnc?: string;
};

function parseChatwootAccountData(raw?: string | null): ChatwootAccountData | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ChatwootAccountData;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || '';
}

// PUT - Atualizar usuário (mudar role)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = parseBody(adminUserUpdateSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, email: true, chatwootUserId: true, deletedAt: true, organization: { select: { deletedAt: true } } },
    });
    if (!existing || existing.deletedAt || existing.organization.deletedAt) {
      return NextResponse.json({ error: 'Usuário não encontrado ou inativo' }, { status: 404 });
    }
    if (data.email && data.email !== existing.email && existing.chatwootUserId) {
      return NextResponse.json({ error: 'E-mail vinculado ao Atendimento. Atualização requer sincronização do usuário Chatwoot.' }, { status: 409 });
    }
    if (data.email && data.email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }
    const user = await prisma.$transaction(async tx => {
      const updated = await tx.user.update({
        where: { id },
        data: { name: data.name, email: data.email, role: data.role },
        select: { id: true, name: true, email: true, role: true,
          organization: { select: { id: true, name: true } } },
      });
      await tx.activity.create({ data: {
        entityType: 'user', entityId: id, action: 'updated', userId: null,
        description: 'Dados de usuário atualizados pelo Super Admin',
        metadata: JSON.stringify({ actorType: 'superadmin', actorId: admin.id, fields: Object.keys(data) }),
      } });
      return updated;
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }
    console.error('[ADMIN USERS] Erro ao atualizar usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE - Excluir usuário + contenção no Chatwoot
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const warnings: string[] = [];

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            chatwootAccountId: true,
            connectedAccounts: {
              where: { provider: 'chatwoot' },
              select: {
                data: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const cwRaw = user.organization?.connectedAccounts?.[0]?.data ?? null;
    const cwData = parseChatwootAccountData(cwRaw);

    const chatwootAccountId =
      user.organization?.chatwootAccountId ??
      cwData?.chatwootAccountId ??
      null;

    const deletedUserEmail = normalizeEmail(user.email);
    const ownerEmail = normalizeEmail(cwData?.ownerEmail);
    const deletingChatwootOwner =
      user.role === 'owner' || (!!ownerEmail && ownerEmail === deletedUserEmail);

    if (chatwootAccountId) {
      try {
        if (deletingChatwootOwner) {
          const { blocked, errors } = await invalidateChatwootUserSessions(chatwootAccountId);

          if (errors.length > 0) {
            warnings.push(`Falha ao encerrar sessões do Atendimento: ${errors.join(', ')}`);
          } else {
            console.info(
              `[ADMIN USERS] Sessões Chatwoot invalidadas após delete de owner: ${blocked.join(', ')}`
            );
          }
        } else if (deletedUserEmail) {
          const { found, blocked, errors } = await invalidateSingleChatwootUserSession(
            chatwootAccountId,
            deletedUserEmail
          );

          if (errors.length > 0) {
            warnings.push(`Falha ao remover usuário do Atendimento: ${errors.join(', ')}`);
          } else if (found) {
            console.info(
              `[ADMIN USERS] Usuário Chatwoot contido após delete individual: ${blocked.join(', ')}`
            );
          }
        }
      } catch (cwErr) {
        console.warn('[ADMIN USERS] Aviso: falha no cleanup do Chatwoot:', cwErr);
        warnings.push('Falha inesperada na limpeza do Atendimento');
      }
    }

    const tx = [];

    if (user.organizationId) {
      if (deletingChatwootOwner) {
        tx.push(
          prisma.connectedAccount.updateMany({
            where: {
              organizationId: user.organizationId,
              provider: 'chatwoot',
            },
            data: {
              isActive: false,
              lastError: 'chatwoot_owner_deleted_requires_reprovision',
              lastSyncAt: new Date(),
            },
          })
        );
      } else {
        tx.push(
          prisma.connectedAccount.updateMany({
            where: {
              organizationId: user.organizationId,
              provider: 'chatwoot',
            },
            data: {
              lastSyncAt: new Date(),
            },
          })
        );
      }
    }

    tx.push(prisma.user.delete({ where: { id } }));

    await prisma.$transaction(tx);

    return NextResponse.json({
      message: deletingChatwootOwner
        ? 'Usuário excluído com sucesso e Atendimento marcado para nova configuração'
        : 'Usuário excluído com sucesso',
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    console.error('[ADMIN USERS] Erro ao excluir usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
