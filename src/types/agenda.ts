// src/types/agenda.ts

export type EventStatus = 'agendado' | 'concluido' | 'cancelado';

export type EventType = 'meeting' | 'call' | 'follow_up' | 'reminder' | 'deadline' | 'other';

export interface AgendaEvent {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  date: string;           // YYYY-MM-DD
  startTime?: string | null;
  endTime?: string | null;
  allDay: boolean;
  type: EventType;
  status: EventStatus;
  color?: string | null;
  location?: string | null;
  isRecurring: boolean;
  recurrenceRule?: string | null;
  reminderMinutes?: number | null;
  reminderSent: boolean;
  leadId?: string | null;
  projectId?: string | null;
  assignedToId?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;

  // Relations (populated)
  lead?: {
    id: string;
    name: string;
  } | null;
  project?: {
    id: string;
    title: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  createdBy?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateAgendaEventInput {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  type?: EventType;
  status?: EventStatus;
  color?: string;
  location?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  reminderMinutes?: number;
  leadId?: string;
  projectId?: string;
  assignedToId?: string;
}

export interface UpdateAgendaEventInput extends Partial<CreateAgendaEventInput> {}
