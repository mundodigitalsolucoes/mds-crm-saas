'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCircle,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import AccessDenied from '@/components/AccessDenied';
import PermissionLoading from '@/components/PermissionLoading';

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

type FollowUpTask = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leadId?: string | null;
  assignedToId?: string | null;
  lead?: {
    id: string;
    name: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
};

const statusLabel: Record<TaskStatus, string> = {
  todo: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

const priorityLabel: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return { start, end };
}

function isSameDay(dateValue?: string | null) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  const { start, end } = getTodayRange();

  return date >= start && date <= end;
}

function isOverdue(task: FollowUpTask) {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;

  const today = getTodayRange().start;
  const dueDate = new Date(task.dueDate);

  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

function isNextSevenDays(task: FollowUpTask) {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;

  const { start } = getTodayRange();
  const limit = new Date(start);
  limit.setDate(limit.getDate() + 7);

  const dueDate = new Date(task.dueDate);

  return dueDate >= start && dueDate <= limit;
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return 'Sem data';

  const [date, time] = dateValue.split('T');

  return `${date.split('-').reverse().join('/')} ${time.slice(0, 5)}`;
}

function getVisualStatus(task: FollowUpTask) {
  if (task.status === 'done') {
    return 'border-green-200 bg-green-50 text-green-700';
  }

  if (isOverdue(task)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (isSameDay(task.dueDate)) {
    return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  }

  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function FollowUpsPage() {
  const { canAccess, isLoading: permLoading } = usePermission();

  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');

  const [newLeadId, setNewLeadId] = useState('');
  const [newAssignedToId, setNewAssignedToId] = useState('');

  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const [editingTask, setEditingTask] = useState<FollowUpTask | null>(null);

  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskAssignedToId, setEditTaskAssignedToId] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<TaskPriority>('medium');
  const [editTaskStatus, setEditTaskStatus] = useState<TaskStatus>('todo');
  const [editTaskLeadId, setEditTaskLeadId] = useState('');

  const [creatingTask, setCreatingTask] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      setError('');

                 const response = await fetch('/api/tasks?pageSize=500&type=follow_up');

      if (!response.ok) {
        throw new Error('Erro ao carregar follow-ups');
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Erro ao carregar follow-ups:', err);
      setError('Erro ao carregar follow-ups comerciais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  if (!canAccess('tasks')) {
    setLoading(false);
    setError('Seu usuário não tem permissão para visualizar tarefas/follow-ups.');
    return;
  }

  fetchFollowUps();

  const fetchDependencies = async () => {
    try {
      const [usersResponse, leadsResponse] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/leads?limit=500'),
      ]);

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();

        setUsers(
          (usersData || []).map((user: any) => ({
            id: user.id,
            name: user.name,
          }))
        );
      }

      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();

        setLeads(
          (leadsData.leads || []).map((lead: any) => ({
            id: lead.id,
            name: lead.name || 'Lead sem nome',
          }))
        );
      }
    } catch (err) {
      console.error('Erro ao carregar dependências do follow-up:', err);
    }
  };

  fetchDependencies();
}, [canAccess]);

  const responsibleOptions = useMemo(() => {
    const map = new Map<string, string>();

    tasks.forEach((task) => {
      if (task.assignedToId && task.assignedTo?.name) {
        map.set(task.assignedToId, task.assignedTo.name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !normalizedSearch ||
        task.title.toLowerCase().includes(normalizedSearch) ||
        task.description?.toLowerCase().includes(normalizedSearch) ||
        task.lead?.name.toLowerCase().includes(normalizedSearch);

      const matchesStatus = !statusFilter || task.status === statusFilter;
      const matchesPriority = !priorityFilter || task.priority === priorityFilter;
      const matchesAssigned = !assignedFilter || task.assignedToId === assignedFilter;

      const matchesPeriod =
        !periodFilter ||
        (periodFilter === 'overdue' && isOverdue(task)) ||
        (periodFilter === 'today' && isSameDay(task.dueDate)) ||
        (periodFilter === 'next7' && isNextSevenDays(task)) ||
        (periodFilter === 'no_assignee' && !task.assignedToId);

      return matchesSearch && matchesStatus && matchesPriority && matchesAssigned && matchesPeriod;
    });
  }, [tasks, search, statusFilter, priorityFilter, assignedFilter, periodFilter]);

  const kpis = useMemo(() => {
  return {
    overdue: tasks.filter(isOverdue).length,
    today: tasks.filter((task) => isSameDay(task.dueDate) && task.status !== 'done').length,
    next7: tasks.filter(isNextSevenDays).length,
    completedToday: tasks.filter((task) => task.status === 'done' && isSameDay(task.completedAt)).length,
  };
}, [tasks]);

  const completeTask = async (taskId: string) => {
    try {
      setUpdatingTaskId(taskId);

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });

      if (!response.ok) {
        throw new Error('Erro ao concluir follow-up');
      }

      await fetchFollowUps();
    } catch (err) {
      console.error('Erro ao concluir follow-up:', err);
      alert('Erro ao concluir follow-up.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const rescheduleTask = async (task: FollowUpTask) => {
    const currentDateTime = task.dueDate
      ? new Date(task.dueDate).toISOString().slice(0, 16)
      : '';

    const newDate = window.prompt(
      'Nova data e horário do follow-up (AAAA-MM-DDTHH:mm)',
      currentDateTime
    );

    if (!newDate) return;

    try {
      setUpdatingTaskId(task.id);

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: newDate,
          status: task.status === 'done' ? 'todo' : task.status,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao reagendar follow-up');
      }

      await fetchFollowUps();
    } catch (err) {
      console.error('Erro ao reagendar follow-up:', err);
      alert('Erro ao reagendar follow-up.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const createTask = async () => {
    if (!newTitle.trim() || !newDueDate) {
      alert('Preencha título e data do follow-up');
      return;
    }

    try {
      setCreatingTask(true);

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify({
  title: newTitle.trim(),
  type: 'follow_up',
  dueDate: newDueDate,
  priority: newPriority,
  status: 'todo',
  ...(newLeadId ? { leadId: newLeadId } : {}),
  ...(newAssignedToId ? { assignedToId: newAssignedToId } : {}),
}),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar follow-up');
      }

      const createdTask = await response.json();

      setTasks((prev) => [createdTask, ...prev]);
      setNewTitle('');
      setNewDueDate('');
      setNewPriority('medium');
      setNewLeadId('');
      setNewAssignedToId('');
    } catch (err) {
      console.error('Erro ao criar follow-up:', err);
      alert('Erro ao criar follow-up.');
    } finally {
      setCreatingTask(false);
    }
  };

    const deleteTask = async (taskId: string) => {
  const confirmed = window.confirm(
    'Deseja realmente excluir este follow-up?'
  );

  if (!confirmed) return;

  try {
    setUpdatingTaskId(taskId);

    const response = await fetch(
      `/api/tasks/${taskId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error(
        'Erro ao excluir follow-up'
      );
    }

    setTasks((prev) =>
      prev.filter(
        (task) => task.id !== taskId
      )
    );
  } catch (err) {
    console.error(
      'Erro ao excluir follow-up:',
      err
    );

    alert('Erro ao excluir follow-up.');
  } finally {
    setUpdatingTaskId(null);
  }
};

const openTaskEditor = (
  task: FollowUpTask
) => {
  setEditingTask(task);

  setEditTaskTitle(task.title || '');

  setEditTaskDescription(
    task.description || ''
  );

  setEditTaskDueDate(
    task.dueDate
      ? new Date(task.dueDate)
          .toISOString()
          .slice(0, 16)
      : ''
  );

  setEditTaskAssignedToId(
  task.assignedToId || ''
);

setEditTaskPriority(task.priority || 'medium');
setEditTaskStatus(task.status || 'todo');
setEditTaskLeadId(task.leadId || '');
};

const saveTaskChanges = async () => {
  if (!editingTask) return;

  try {
    const response = await fetch(
      `/api/tasks/${editingTask.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
  title: editTaskTitle,
  description: editTaskDescription,
  dueDate: editTaskDueDate || null,
  assignedToId: editTaskAssignedToId || null,
  priority: editTaskPriority,
  status: editTaskStatus,
  leadId: editTaskLeadId || null,
  type: 'follow_up',
}),
      }
    );

    if (!response.ok) {
      throw new Error(
        'Erro ao atualizar follow-up'
      );
    }

    await fetchFollowUps();

    setEditingTask(null);
  } catch (error) {
    console.error(error);

    alert(
      'Erro ao atualizar follow-up'
    );
  }
};

  if (permLoading) return <PermissionLoading />;
  if (!canAccess('tasks')) return <AccessDenied module="tasks" />;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Central de Follow-ups Comerciais</h1>
            <p className="text-sm text-gray-500">
              Cockpit operacional de retornos comerciais baseado em tarefas.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchFollowUps}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Novo Follow-up</h2>
            <p className="text-sm text-gray-500">Crie rapidamente um follow-up operacional</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
  <input
    type="text"
    placeholder="Título do follow-up"
    value={newTitle}
    onChange={(event) => setNewTitle(event.target.value)}
    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
  />

  <input
    type="datetime-local"
    value={newDueDate}
    onChange={(event) => setNewDueDate(event.target.value)}
    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
  />

  <select
    value={newPriority}
    onChange={(event) => setNewPriority(event.target.value as TaskPriority)}
    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
  >
    <option value="low">Baixa</option>
    <option value="medium">Média</option>
    <option value="high">Alta</option>
    <option value="urgent">Urgente</option>
  </select>

  <select
    value={newLeadId}
    onChange={(event) => setNewLeadId(event.target.value)}
    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
  >
    <option value="">Selecionar lead</option>

    {leads.map((lead) => (
      <option key={lead.id} value={lead.id}>
        {lead.name}
      </option>
    ))}
    </select>

  <select
  value={newAssignedToId}
  onChange={(event) => setNewAssignedToId(event.target.value)}
  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
>
  <option value="">Eu mesmo</option>

  {users.map((user) => (
    <option key={user.id} value={user.id}>
      {user.name}
    </option>
  ))}
</select>
</div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={createTask}
              disabled={creatingTask}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {creatingTask ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              Criar Follow-up
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-xl border border-red-200 bg-white p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={18} />
              <span className="text-sm font-medium">Atrasados</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.overdue}</p>
          </div>

          <div className="rounded-xl border border-yellow-200 bg-white p-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <Clock size={18} />
              <span className="text-sm font-medium">Hoje</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.today}</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <CalendarDays size={18} />
              <span className="text-sm font-medium">Próx. 7 dias</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.next7}</p>
          </div>

          <div className="rounded-xl border border-green-200 bg-white p-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 size={18} />
              <span className="text-sm font-medium">Concluídos hoje</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.completedToday}</p>
          </div>
         
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por follow-up, descrição ou lead"
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os períodos</option>
              <option value="overdue">Atrasados</option>
              <option value="today">Hoje</option>
              <option value="next7">Próximos 7 dias</option>
              </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os status</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas prioridades</option>
              {Object.entries(priorityLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {responsibleOptions.length > 0 && (
            <div className="mt-3">
              <select
                value={assignedFilter}
                onChange={(event) => setAssignedFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-indigo-500 md:w-auto"
              >
                <option value="">Todos os responsáveis</option>
                {responsibleOptions.map((responsible) => (
                  <option key={responsible.id} value={responsible.id}>
                    {responsible.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Follow-ups encontrados: {filteredTasks.length}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Carregando follow-ups...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Nenhum follow-up encontrado.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTasks.map((task) => (
                <div key={task.id} className="p-5 hover:bg-gray-50">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${getVisualStatus(task)}`}>
                          {task.status === 'done'
                            ? 'Concluído'
                            : isOverdue(task)
                              ? 'Atrasado'
                              : isSameDay(task.dueDate)
                                ? 'Hoje'
                                : 'Follow-up'}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                          {statusLabel[task.status]}
                        </span>

                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                          {priorityLabel[task.priority]}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-semibold text-gray-900">{task.title}</h3>

                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{task.description}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>Lead: {task.lead?.name || 'Sem lead vinculado'}</span>
                        <span>Responsável: {task.assignedTo?.name || 'Sem responsável'}</span>
                        <span>Data: {formatDate(task.dueDate)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {task.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => completeTask(task.id)}
                          disabled={updatingTaskId === task.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {updatingTaskId === task.id ? (
                            <Loader2 className="animate-spin" size={15} />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}
                          Concluir
                        </button>
                      )}
                       <button
                        type="button"
                        onClick={() => openTaskEditor(task)}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                      >
                         Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => rescheduleTask(task)}
                        disabled={updatingTaskId === task.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <CalendarDays size={15} />
                        Reagendar
                      </button>

                      <Link
                        href={task.leadId ? `/leads?leadId=${task.leadId}` : '/leads'}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                      >
                        Abrir Lead
                      </Link>

                      <Link
                        href="/atendimento"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Atendimento
                      </Link>

                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        disabled={updatingTaskId === task.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
                </div>

        {editingTask && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">

              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Editar Follow-up
                </h3>
              </div>

              <div className="space-y-4 p-6">

                <input
  value={editTaskTitle}
  onChange={(e) =>
    setEditTaskTitle(e.target.value)
  }
  placeholder="Título do follow-up"
  className="w-full rounded-lg border border-gray-300 px-3 py-2"
/>

                <input
                  type="datetime-local"
                  value={editTaskDueDate}
                  onChange={(e) =>
                    setEditTaskDueDate(e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
                <select
  value={editTaskPriority}
  onChange={(e) =>
    setEditTaskPriority(e.target.value as TaskPriority)
  }
  className="w-full rounded-lg border border-gray-300 px-3 py-2"
>
  <option value="low">Prioridade baixa</option>
  <option value="medium">Prioridade média</option>
  <option value="high">Prioridade alta</option>
  <option value="urgent">Prioridade urgente</option>
</select>

<select
  value={editTaskStatus}
  onChange={(e) =>
    setEditTaskStatus(e.target.value as TaskStatus)
  }
  className="w-full rounded-lg border border-gray-300 px-3 py-2"
>
  <option value="todo">Pendente</option>
  <option value="in_progress">Em andamento</option>
  <option value="done">Concluído</option>
  <option value="cancelled">Cancelado</option>
</select>

<select
  value={editTaskLeadId}
  onChange={(e) =>
    setEditTaskLeadId(e.target.value)
  }
  className="w-full rounded-lg border border-gray-300 px-3 py-2"
>
  <option value="">Sem lead vinculado</option>

  {leads.map((lead) => (
    <option key={lead.id} value={lead.id}>
      {lead.name}
    </option>
  ))}
</select>

                <select
  value={editTaskAssignedToId}
  onChange={(e) =>
    setEditTaskAssignedToId(e.target.value)
  }
  className="w-full rounded-lg border border-gray-300 px-3 py-2"
>
  <option value="">Sem responsável</option>

  {users.map((user) => (
    <option
      key={user.id}
      value={user.id}
    >
      {user.name}
    </option>
  ))}
</select>

                <textarea
  rows={4}
  value={editTaskDescription}
  onChange={(e) =>
    setEditTaskDescription(
      e.target.value
    )
  }
  placeholder="Descrição ou observação do follow-up"
  className="w-full rounded-lg border border-gray-300 px-3 py-2"
/>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">

                <button
                  onClick={() =>
                    setEditingTask(null)
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2"
                >
                  Cancelar
                </button>

                <button
                  onClick={saveTaskChanges}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
                >
                  Salvar
                </button>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
