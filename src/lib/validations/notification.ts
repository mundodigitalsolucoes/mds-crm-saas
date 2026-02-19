// src/lib/validations/notification.ts
// Schemas Zod para API de Notifications — MDS CRM
import { z } from 'zod';

// ============================================
// MARK READ — POST /api/notifications/read
// ============================================

export const notificationMarkReadSchema = z.object({
  ids: z
    .array(z.string().uuid('ID deve ser um UUID válido'))
    .optional(),
  all: z.boolean().optional(),
}).refine(
  (data) => data.all || (data.ids && data.ids.length > 0),
  { message: 'Informe "all: true" ou uma lista de "ids"' }
);

export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;
