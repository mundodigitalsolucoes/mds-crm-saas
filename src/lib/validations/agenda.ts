// src/lib/validations/agenda.ts
// Schemas Zod para API de Agenda — MDS CRM
import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const eventTypeEnum = z.enum([
  'meeting', 'call', 'follow_up', 'reminder', 'deadline', 'other',
]);

export const eventStatusEnum = z.enum(['agendado', 'concluido', 'cancelado']);

// ============================================
// REGEX PATTERNS
// ============================================

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

// ============================================
// CREATE — POST /api/agenda
// ============================================

export const agendaCreateSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().max(2000).optional(),
  date: z.string().regex(datePattern, 'Data deve estar no formato YYYY-MM-DD'),
  startTime: z.string().regex(timePattern, 'Horário deve estar no formato HH:MM').optional(),
  endTime: z.string().regex(timePattern, 'Horário deve estar no formato HH:MM').optional(),
  allDay: z.boolean().optional().default(false),
  type: eventTypeEnum.optional().default('meeting'),
  status: eventStatusEnum.optional().default('agendado'),
  color: z.string().max(20).optional(),
  location: z.string().max(500).optional(),
  isRecurring: z.boolean().optional().default(false),
  recurrenceRule: z.string().max(500).optional(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(),
  leadId: z.string().uuid('Lead ID inválido').optional(),
  projectId: z.string().uuid('Projeto ID inválido').optional(),
  assignedToId: z.string().uuid('Usuário ID inválido').optional(),
});

export type AgendaCreateInput = z.infer<typeof agendaCreateSchema>;

// ============================================
// UPDATE — PUT /api/agenda/[id]
// ============================================

export const agendaUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z.string().regex(datePattern, 'Data deve estar no formato YYYY-MM-DD').optional(),
  startTime: z.string().regex(timePattern, 'Horário deve estar no formato HH:MM').nullable().optional(),
  endTime: z.string().regex(timePattern, 'Horário deve estar no formato HH:MM').nullable().optional(),
  allDay: z.boolean().optional(),
  type: eventTypeEnum.optional(),
  status: eventStatusEnum.optional(),
  color: z.string().max(20).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  leadId: z.string().uuid('Lead ID inválido').nullable().optional(),
  projectId: z.string().uuid('Projeto ID inválido').nullable().optional(),
  assignedToId: z.string().uuid('Usuário ID inválido').nullable().optional(),
});

export type AgendaUpdateInput = z.infer<typeof agendaUpdateSchema>;
