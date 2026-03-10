// src/app/api/admin/users/[id]/route.ts
// API Admin — Atualização e Exclusão de Usuário
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { parseBody, adminUserUpdateSchema } from '@/lib/validations';
import { getChatwootCredentials, chatwootApi } from '@/lib/chatwoot';

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
    // 1. Busca o usuário e os dados do Chatwoot antes de deletar
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        organizationId: true,
        organization: {
          select: { chatwootAccountId: true },
        },
      },
    });

    // 2. Tenta deletar no Chatwoot (se tiver integração ativa)
    if (user?.organizationId) {
      try {
        const credentials = await getChatwootCredentials(user.organizationId);

        if (credentials) {
          // Busca o ConnectedAccount para pegar o chatwootUserId
          const connectedAccount = await prisma.connectedAccount.findUnique({
            where: {
              provider_organizationId: {
                provider: 'chatwoot',
                organizationId: user.organizationId,
              },
            },
            select: { data: true },
          });

          if (connectedAccount?.data) {
            const cwData = JSON.parse(connectedAccount.data) as {
              chatwootUserId?: number;
            };

            if (cwData.chatwootUserId) {
              // Remove o usuário da conta Chatwoot
              await chatwootApi(credentials, `/agents/${cwData.chatwootUserId}`, {
                method: 'DELETE',
              });
              console.info(`[ADMIN USERS] ✅ Usuário Chatwoot #${cwData.chatwootUserId} removido`);
            }
          }
        }
      } catch (cwErr) {
        // Loga mas não bloqueia — o delete do CRM deve continuar
        console.warn('[ADMIN USERS] Aviso: falha ao deletar no Chatwoot:', cwErr);
      }
    }

    // 3. Deleta do CRM (cascade deleta ConnectedAccount e outros dados)
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('[ADMIN USERS] Erro ao excluir usuário:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}