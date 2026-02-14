'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAgendaStore } from '@/store/agendaStore';
import type { AgendaEvent, EventStatus, EventType } from '@/types/agenda';

interface AgendaEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AgendaEvent | null;
}

export function AgendaEventModal({ isOpen, onClose, initialData }: AgendaEventModalProps) {
  const { addEvent, updateEvent } = useAgendaStore();

    const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '',
    endTime: '',
    status: 'agendado' as EventStatus,
    location: '',
    type: 'meeting' as EventType,  // ← adiciona "as EventType"
    allDay: false,
  });

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setForm({
        title: initialData.title || '',
        description: initialData.description || '',
        date: initialData.date ? initialData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        startTime: initialData.startTime || '',
        endTime: initialData.endTime || '',
        status: initialData.status || 'agendado',
        location: initialData.location || '',
        type: initialData.type || 'meeting',
        allDay: initialData.allDay || false,
      });
    } else {
      setForm({
        title: '',
        description: '',
        date: new Date().toISOString().slice(0, 10),
        startTime: '',
        endTime: '',
        status: 'agendado',
        location: '',
        type: 'meeting',
        allDay: false,
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.date) {
      alert('Preencha Título e Data.');
      return;
    }

    if (form.startTime && form.endTime && form.endTime < form.startTime) {
      alert('Horário final não pode ser menor que o horário inicial.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      date: form.date,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      status: form.status,
      location: form.location || undefined,
      type: form.type,
      allDay: form.allDay,
    };

    if (initialData?.id) {
      await updateEvent(initialData.id, payload);
    } else {
      await addEvent(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Editar evento' : 'Novo evento'}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg" type="button">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
              <input
                type="time"
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
              <input
                type="time"
                name="endTime"
                value={form.endTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {(['agendado', 'concluido', 'cancelado'] as EventStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s === 'agendado' ? 'Agendado' : s === 'concluido' ? 'Concluído' : 'Cancelado'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              {initialData ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
