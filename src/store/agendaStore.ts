import { create } from 'zustand';

export type EventStatus = 'agendado' | 'concluido' | 'cancelado';

export interface AgendaEvent {
  id: number;
  title: string;
  description?: string;
  date: string;      // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  status: EventStatus;
  location?: string;
}

interface AgendaStore {
  events: AgendaEvent[];
  addEvent: (data: Omit<AgendaEvent, 'id'>) => AgendaEvent;
  updateEvent: (id: number, updates: Partial<Omit<AgendaEvent, 'id'>>) => void;
  deleteEvent: (id: number) => void;
  getEventById: (id: number) => AgendaEvent | undefined;
}

export const useAgendaStore = create<AgendaStore>((set, get) => ({
  events: [
    {
      id: 1,
      title: 'Reunião com cliente',
      description: 'Alinhar próximos passos',
      date: '2026-02-05',
      startTime: '10:00',
      endTime: '11:00',
      status: 'agendado',
      location: 'Google Meet',
    },
    {
      id: 2,
      title: 'Revisão de campanha',
      date: '2026-02-06',
      startTime: '15:00',
      status: 'agendado',
    },
  ],

  addEvent: (data) => {
    const nextId = Math.max(0, ...get().events.map((e) => e.id)) + 1;
    const newEvent: AgendaEvent = { id: nextId, ...data };
    set((state) => ({ events: [newEvent, ...state.events] }));
    return newEvent;
  },

  updateEvent: (id, updates) => {
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  },

  deleteEvent: (id) => {
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
  },

  getEventById: (id) => get().events.find((e) => e.id === id),
}));
