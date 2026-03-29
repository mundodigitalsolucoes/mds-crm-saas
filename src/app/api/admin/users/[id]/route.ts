// src/app/api/admin/users/[id]/route.ts
// API Admin — Atualização e Exclusão de Usuário
import { NextRequest, NextResponse } from 'next/server';
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

    const user = await prisma.user.update({
      where: { id },
      data: { role: data.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
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
            warnings.push(`Falha ao conter sessões Chatwoot do owner: ${errors.join(', ')}`);
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
            warnings.push(`Falha ao conter usuário no Chatwoot: ${errors.join(', ')}`);
          } else if (found) {
            console.info(
              `[ADMIN USERS] Usuário Chatwoot contido após delete individual: ${blocked.join(', ')}`
            );
          }
        }
      } catch (cwErr) {
        console.warn('[ADMIN USERS] Aviso: falha no cleanup do Chatwoot:', cwErr);
        warnings.push('Falha inesperada no cleanup do Chatwoot');
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
        ? 'Usuário excluído com sucesso e Chatwoot marcado para reprovision'
        : 'Usuário excluído com sucesso',
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    console.error('[ADMIN USERS] Erro ao excluir usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}