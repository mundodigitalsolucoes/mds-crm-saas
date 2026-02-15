'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, Calendar, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAgendaStore } from '@/store/agendaStore';
import type { AgendaEvent } from '@/types/agenda';
import { AgendaEventModal } from '@/components/AgendaEventModal';
import { PomodoroTimer } from '@/components/PomodoroTimer';

// Normaliza a data do evento para YYYY-MM-DD (independente se vem ISO ou já formatado)
function normalizeDate(date: string): string {
  if (!date) return '';
  // Se for ISO (2026-02-14T00:00:00.000Z), pega só os primeiros 10 chars
  return date.substring(0, 10);
}

export default function AgendaPage() {
  const { events, loading, error, fetchEvents, deleteEvent } = useAgendaStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<AgendaEvent | null>(null);

  // ✅ Buscar eventos ao montar a página e quando o mês muda
  useEffect(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    fetchEvents({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    });
  }, [currentMonth, fetchEvents]);

  // Eventos do dia selecionado (com normalização de data)
  const eventsOfSelectedDay = useMemo(() => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return events
      .filter(event => normalizeDate(event.date) === dateString)
      .sort((a, b) => {
        const aKey = a.startTime || '99:99';
        const bKey = b.startTime || '99:99';
        return aKey.localeCompare(bKey);
      });
  }, [events, selectedDate]);

  // Dias do mês atual para o calendário
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Verifica se um dia tem eventos (com normalização)
  const hasEvents = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return events.some(event => normalizeDate(event.date) === dateString);
  };

  const openNew = () => {
    setSelected(null);
    setIsModalOpen(true);
  };

  const openEdit = (ev: AgendaEvent) => {
    setSelected(ev);
    setIsModalOpen(true);
  };

  const onDelete = async (id: string) => {
    if (window.confirm('Excluir este evento?')) {
      await deleteEvent(id);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'agendado':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Agendado</span>;
      case 'concluido':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Concluído</span>;
      case 'cancelado':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Cancelado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-sm text-gray-500">Eventos, compromissos e foco</p>
          </div>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Layout Principal - 2 Colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUNA ESQUERDA: Calendário + Pomodoro */}
          <div className="lg:col-span-1 space-y-6">
            {/* Calendário */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {/* Cabeçalho dos dias da semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Dias do calendário */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  const dayHasEvents = hasEvents(day);

                  return (
                    <button
                      key={day.toString()}
                      onClick={() => handleDateSelect(day)}
                      className={`
                        p-2 text-sm rounded-lg relative transition-all duration-200
                        ${isSelected 
                          ? 'bg-indigo-600 text-white shadow-lg' 
                          : isTodayDate 
                            ? 'bg-indigo-100 text-indigo-800 font-semibold' 
                            : isSameMonth(day, currentMonth)
                              ? 'hover:bg-gray-100 text-gray-900'
                              : 'text-gray-300 cursor-not-allowed'
                        }
                      `}
                      disabled={!isSameMonth(day, currentMonth)}
                    >
                      {format(day, 'd')}
                      {dayHasEvents && (
                        <div className={`
                          absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full
                          ${isSelected ? 'bg-white' : 'bg-indigo-500'}
                        `} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pomodoro Timer */}
            <PomodoroTimer />
          </div>

          {/* COLUNA DIREITA: Eventos do Dia Selecionado */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="text-indigo-600" size={24} />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Eventos de {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {isToday(selectedDate) && "Hoje • "}
                      {eventsOfSelectedDay.length} evento(s)
                    </p>
                  </div>
                </div>

                <button
                  onClick={openNew}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus size={18} />
                  Novo evento
                </button>
              </div>

              {/* Lista de eventos */}
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                    <span className="ml-3 text-gray-500">Carregando eventos...</span>
                  </div>
                ) : eventsOfSelectedDay.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500 text-lg mb-2">Nenhum evento neste dia</p>
                    <p className="text-gray-400 text-sm">
                      Clique em &quot;Novo evento&quot; para adicionar um compromisso
                    </p>
                  </div>
                ) : (
                  eventsOfSelectedDay.map((event) => (
                    <div
                      key={event.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="text-gray-400" size={16} />
                            <span className="font-semibold text-gray-900">{event.title}</span>
                            {getStatusBadge(event.status)}
                          </div>

                          <div className="text-sm text-gray-600 space-y-1">
                            {(event.startTime || event.endTime) && (
                              <div>
                                {event.startTime && <span>{event.startTime}</span>}
                                {event.startTime && event.endTime && <span> – </span>}
                                {event.endTime && <span>{event.endTime}</span>}
                              </div>
                            )}
                            {event.location && (
                              <div>📍 {event.location}</div>
                            )}
                            {event.description && (
                              <div className="text-gray-500 mt-2">{event.description}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => openEdit(event)}
                            className="p-2 rounded-md text-gray-500 hover:bg-gray-200 hover:text-indigo-600 transition-colors"
                            title="Editar evento"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => onDelete(event.id)}
                            className="p-2 rounded-md text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="Excluir evento"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Evento */}
      <AgendaEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selected}
      />
    </div>
  );
}
