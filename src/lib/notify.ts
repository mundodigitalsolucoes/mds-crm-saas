// src/lib/notify.ts
// Helper server-side para criar notificações sem quebrar o fluxo principal
// Nunca lança erro — use em qualquer API route com segurança

import { prisma } from '@/lib/prisma';

export type NotificationType =
  | 'task_assigned'
  | 'task_due'
  | 'task_completed'
  | 'lead_created'
  | 'lead_assigned'
  | 'os_created'
  | 'os_assigned'
  | 'os_updated'
  | 'goal_created'
  | 'goal_completed'
  | 'mention'
  | 'invite_sent'
  | 'chatwoot_conversation'
  | 'chatwoot_message';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Cria uma notificação para um usuário.
 * Nunca lança exceção — falhas são logadas silenciosamente.
 * Ideal para disparar após criação/atualização de entidades.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    });
  } catch (error) {
    console.error('[notify] Falha ao criar notificação:', error);
  }
}

/**
 * Cria notificações para múltiplos usuários ao mesmo tempo.
 * Útil para notificar todos os admins ou uma lista de membros.
 * Nunca lança exceção.
 */
export async function createNotificationMany(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
      })),
    });
  } catch (error) {
    console.error('[notify] Falha ao criar notificações em lote:', error);
  }
}
