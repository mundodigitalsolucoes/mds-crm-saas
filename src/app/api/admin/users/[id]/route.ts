// src/app/api/admin/users/[id]/route.ts
// API Admin — Atualização e Exclusão de Usuário
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { parseBody, adminUserUpdateSchema } from '@/lib/validations';
import { deleteChatwootUser, deleteChatwootAccount } from '@/lib/integrations/chatwoot-cleanup';

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

// DELETE - Excluir usuário + limpeza no Chatwoot
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
    // 1. Busca o usuário e dados do Chatwoot antes de deletar
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        organizationId: true,
        organization: {
          select: {
            chatwootAccountId: true,
            connectedAccounts: {
              where: { provider: 'chatwoot' },
              select: { data: true },
            },
          },
        },
      },
    });

    // 2. Tenta limpar no Chatwoot
    if (user?.organizationId) {
      try {
        const cwAccount = user.organization?.connectedAccounts?.[0];
        if (cwAccount?.data) {
          const cwData = JSON.parse(cwAccount.data) as {
            chatwootUserId?: number;
            chatwootAccountId?: number;
          };

          if (cwData.chatwootUserId && cwData.chatwootAccountId) {
            // Passa accountId para deletar como owner (cascade deleta a conta)
            await deleteChatwootUser(cwData.chatwootUserId, cwData.chatwootAccountId);
          } else if (cwData.chatwootAccountId) {
            await deleteChatwootAccount(cwData.chatwootAccountId);
          }
        } else if (user.organization?.chatwootAccountId) {
          await deleteChatwootAccount(user.organization.chatwootAccountId);
        }
      } catch (cwErr) {
        console.warn('[ADMIN USERS] Aviso: falha ao deletar no Chatwoot:', cwErr);
      }
    }

    // 3. Deleta do CRM
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('[ADMIN USERS] Erro ao excluir usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}