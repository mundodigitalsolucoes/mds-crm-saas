// src/app/(app)/tasks/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  List,
  LayoutGrid,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ChevronDown,
  X,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { TaskDetailModal, TaskFormModal } from '@/components/tasks';
import type { Task, TaskStatus, TaskPriority } from '@/types/task';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ViewMode = 'list' | 'board';
type FilterTab = 'all' | 'today' | 'overdue' | 'done';

export default function TasksPage() {
  const {
    tasks,
    isLoading,
    pagination,
    filters,
    fetchTasks,
    setFilters,
    clearFilters,
    deleteTask,
    toggleTaskStatus,
    getStatusLabel,
    getStatusColor,
    getPriorityLabel,
    getPriorityColor,
  } = useTaskStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Filtros locais
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');

  // Fetch inicial
  useEffect(() => {
    fetchTasks();
  }, []);

  // Aplicar tab filter
  useEffect(() => {
    const newFilters: any = { ...filters };
    delete newFilters.isToday;
    delete newFilters.isOverdue;
    delete newFilters.status;

    switch (activeTab) {
      case 'today':
        newFilters.isToday = true;
        break;
      case 'overdue':
        newFilters.isOverdue = true;
        break;
      case 'done':
        newFilters.status = 'done';
        break;
    }

    setFilters(newFilters);
  }, [activeTab]);

  // Aplicar filtros avançados
  const handleApplyFilters = () => {
    const newFilters: any = {};
    if (statusFilter) newFilters.status = statusFilter;
    if (priorityFilter) newFilters.priority = priorityFilter;
    if (searchQuery) newFilters.search = searchQuery;
    setFilters(newFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setSearchQuery('');
    clearFilters();
    setShowFilters(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchQuery });
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowFormModal(true);
    setSelectedTaskId(null);
  };

  const handleDelete = async (taskId: string) => {
    if (confirm('Excluir esta tarefa?')) {
      await deleteTask(taskId);
    }
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setShowFormModal(true);
  };

  const getTaskDueStatus = (task: Task) => {
    if (!task.dueDate || task.status === 'done' || task.status === 'cancelled') return null;
    const dueDate = parseISO(task.dueDate);
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    if (isToday(dueDate)) return 'today';
    return null;
  };

  const tabs = [
    { id: 'all' as FilterTab, label: 'Todas', icon: List },
    { id: 'today' as FilterTab, label: 'Hoje', icon: Calendar },
    { id: 'overdue' as FilterTab, label: 'Atrasadas', icon: AlertTriangle },
    { id: 'done' as FilterTab, label: 'Concluídas', icon: CheckCircle2 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tarefas</h1>
          <p className="text-gray-500">Gerencie suas tarefas e acompanhe o progresso</p>
        </div>
        <button
          onClick={handleNewTask}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          Nova Tarefa
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tarefas..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </form>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
            showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Filter size={18} />
          Filtros
          <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`p-2 rounded ${viewMode === 'board' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todos</option>
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Andamento</option>
                <option value="done">Concluída</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todas</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Aplicar Filtros
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Nenhuma tarefa encontrada</p>
            <button
              onClick={handleNewTask}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Criar primeira tarefa
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => {
              const dueStatus = getTaskDueStatus(task);

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskStatus(task.id);
                    }}
                    className={`flex-shrink-0 ${
                      task.status === 'done' ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {task.status === 'done' ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${
                          task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task._count?.subtasks ? (
                        <span className="text-xs text-gray-500">
                          ({task.subtasks?.filter((s) => s.completed).length || 0}/{task._count.subtasks})
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      {task.project && <span>{task.project.title}</span>}
                      {task.assignedTo && <span>@{task.assignedTo.name}</span>}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3">
                    {/* Priority */}
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>

                    {/* Due date */}
                    {task.dueDate && (
                      <span
                        className={`flex items-center gap-1 text-sm ${
                          dueStatus === 'overdue'
                            ? 'text-red-600'
                            : dueStatus === 'today'
                            ? 'text-orange-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {dueStatus === 'overdue' && <AlertTriangle size={14} />}
                        {dueStatus === 'today' && <Clock size={14} />}
                        {format(parseISO(task.dueDate), 'dd/MM', { locale: ptBR })}
                      </span>
                    )}

                    {/* Status badge */}
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-gray-500">
              {pagination.total} tarefa{pagination.total !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => useTaskStore.getState().setPage(page)}
                  className={`px-3 py-1 rounded ${
                    pagination.page === page
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-gray-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

       {/* Modals */}
      <TaskDetailModal
        taskId={selectedTaskId || ''}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <TaskFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingTask(null);
        }}
        onSubmit={async (data) => {
          try {
            if (editingTask) {
              // Editar tarefa existente
              await fetch(`/api/tasks/${editingTask.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              });
            } else {
              // Criar nova tarefa
              await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              });
            }
            // Recarregar lista
            fetchTasks();
          } catch (error) {
            console.error('Erro ao salvar tarefa:', error);
            throw error;
          }
        }}
        initialData={editingTask ? {
          title: editingTask.title,
          description: editingTask.description || '',
          status: editingTask.status,
          priority: editingTask.priority,
          dueDate: editingTask.dueDate?.split('T')[0] || '',
          startDate: editingTask.startDate?.split('T')[0] || '',
          estimatedMinutes: editingTask.estimatedMinutes || undefined,
        } : undefined}
        mode={editingTask ? 'edit' : 'create'}
      />
    </div>
  );
}
     