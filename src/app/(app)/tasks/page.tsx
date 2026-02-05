'use client';

import { Search, Bell, Plus, CheckCircle, Circle, Clock, Edit, Trash2, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { useProjectStore } from '@/store/projectStore';
import type { Task, TaskStatus } from '@/types/task';
import { useRouter } from 'next/navigation';

// Componente para card de estatística
function StatCard({ title, value, icon, color }: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  color: 'blue' | 'green' | 'yellow' | 'gray' | 'red' 
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// Componente para card de tarefa
function TaskCard({ task, onToggleCompletion, onEdit, onDelete }: {
  task: Task;
  onToggleCompletion: (id: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}) {
  const { getProjectById } = useProjectStore();
  const { getTaskStatusDisplay, getTaskStatusColorClass, getTaskPriorityColorClass } = useTaskStore();
  const router = useRouter();

  const project = getProjectById(task.projectId);

  const handleOSClick = (osId: number) => {
    router.push(`/os?osId=${osId}`);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={task.status === 'concluida'}
            onChange={() => onToggleCompletion(task.id)}
            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className={`font-bold text-gray-900 mb-1 ${task.status === 'concluida' ? 'line-through text-gray-500' : ''}`}>
                {task.title}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{task.description}</p>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full border ${getTaskPriorityColorClass(task.priority)} ml-3`}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 text-xs rounded-full ${getTaskStatusColorClass(task.status)}`}>
              {getTaskStatusDisplay(task.status)}
            </span>
            {project && (
              <span className="text-gray-600">📁 {project.nome}</span>
            )}
            {task.osId && (
              <button
                onClick={() => handleOSClick(task.osId as number)}
                className="text-indigo-600 hover:underline flex items-center gap-1"
                title="Ver OS vinculada"
              >
                #OS{task.osId}
              </button>
            )}
            <span className="text-gray-600">👤 {task.assignee || 'Não atribuído'}</span>
            <span className="text-gray-600">📅 {formatDate(task.dueDate)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 ml-4">
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-gray-100"
            title="Editar Tarefa"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-gray-100"
            title="Excluir Tarefa"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de nova/editar tarefa
function NewEditTaskModal({ isOpen, onClose, initialData }: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Task | null;
}) {
  const { addTask, updateTask, getTaskStatusDisplay } = useTaskStore();
  const { projects } = useProjectStore();

  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: 'nova',
    priority: 'media',
    assignee: '',
    dueDate: '',
    projectId: undefined,
    osId: undefined,
  });

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'nova',
        priority: 'media',
        assignee: '',
        dueDate: '',
        projectId: undefined,
        osId: undefined,
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'projectId' || name === 'osId' ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.projectId) {
      alert('Título e Projeto são obrigatórios.');
      return;
    }

    const taskData = {
      ...formData,
      projectId: Number(formData.projectId),
      osId: formData.osId ? Number(formData.osId) : undefined,
      priority: formData.priority || 'media',
      status: formData.status || 'nova',
      assignee: formData.assignee || undefined,
      description: formData.description || undefined,
      dueDate: formData.dueDate || undefined,
    } as Omit<Task, 'id' | 'createdAt' | 'doneAt'>;

    if (initialData?.id) {
      updateTask(initialData.id, taskData);
    } else {
      addTask(taskData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-lg" type="button">
            <X size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              name="title"
              value={formData.title || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projeto *</label>
            <select
              name="projectId"
              value={formData.projectId || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
              required
            >
              <option value="">Selecione um projeto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.cliente})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OS Vinculada (opcional)</label>
            <input
              type="number"
              name="osId"
              value={formData.osId || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
              placeholder="ID da OS"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
            <input
              type="text"
              name="assignee"
              value={formData.assignee || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
            <select
              name="priority"
              value={formData.priority || 'media'}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status || 'nova'}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500"
            >
              <option value="nova">{getTaskStatusDisplay('nova')}</option>
              <option value="em_aprovacao">{getTaskStatusDisplay('em_aprovacao')}</option>
              <option value="aprovada">{getTaskStatusDisplay('aprovada')}</option>
              <option value="em_andamento">{getTaskStatusDisplay('em_andamento')}</option>
              <option value="concluida">{getTaskStatusDisplay('concluida')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              {initialData ? 'Salvar Alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { tasks, toggleTaskCompletion, deleteTask } = useTaskStore();
  const { getTaskStatusColorClass } = useTaskStore();
  const { projects, getProjectById } = useProjectStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'todos'>('todos');
  const [filterProject, setFilterProject] = useState<number | 'todos'>('todos');
  const [showNewEditModal, setShowNewEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const statusFilterOptions: Array<{ value: TaskStatus | 'todos'; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'nova', label: 'Nova' },
    { value: 'em_aprovacao', label: 'Em Aprovação' },
    { value: 'aprovada', label: 'Aprovada' },
    { value: 'em_andamento', label: 'Em Andamento' },
    { value: 'concluida', label: 'Concluída' },
  ];

  const filteredTasks = useMemo(() => {
    let currentTasks = tasks;

    if (filterStatus !== 'todos') {
      currentTasks = currentTasks.filter(task => task.status === filterStatus);
    }
    if (filterProject !== 'todos') {
      currentTasks = currentTasks.filter(task => task.projectId === filterProject);
    }
    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      currentTasks = currentTasks.filter(task => {
        const project = getProjectById(task.projectId);
        const projectName = project?.nome?.toLowerCase() || '';
        return (
          task.title.toLowerCase().includes(lowerCaseSearch) ||
          task.description?.toLowerCase().includes(lowerCaseSearch) ||
          task.assignee?.toLowerCase().includes(lowerCaseSearch) ||
          projectName.includes(lowerCaseSearch)
        );
      });
    }
    return currentTasks;
  }, [tasks, filterStatus, filterProject, searchTerm, getProjectById]);

  const handleOpenNewModal = () => {
    setSelectedTask(null);
    setShowNewEditModal(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setSelectedTask(task);
    setShowNewEditModal(true);
  };

  const handleDeleteTask = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
      deleteTask(id);
    }
  };

  // Contadores para os StatCards
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter(t => t.status === 'em_andamento' || t.status === 'aprovada').length;
  const completedTasks = tasks.filter(t => t.status === 'concluida').length;
  const newTasks = tasks.filter(t => t.status === 'nova' || t.status === 'em_aprovacao').length;

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tarefas</h1>
            <p className="text-sm text-gray-500 mt-1">Gerenciamento de tarefas</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar tarefas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Avatar */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                F
              </div>
              <span className="text-sm font-medium">Fábio Alves Ramos</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenNewModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus size={20} />
              Nova Tarefa
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              <strong>{filteredTasks.length}</strong> tarefas filtradas
            </span>
          </div>
        </div>

        {/* Filter Tabs & Project Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {statusFilterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterStatus(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border'
              }`}
            >
              {option.label}
            </button>
          ))}
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white text-gray-700 border"
          >
            <option value="todos">Todos os Projetos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total de Tarefas"
            value={totalTasks.toString()}
            icon={<Circle size={24} />}
            color="blue"
          />
          <StatCard
            title="Em Andamento"
            value={inProgressTasks.toString()}
            icon={<Clock size={24} />}
            color="yellow"
          />
          <StatCard
            title="Concluídas"
            value={completedTasks.toString()}
            icon={<CheckCircle size={24} />}
            color="green"
          />
          <StatCard
            title="Novas/Aguardando"
            value={newTasks.toString()}
            icon={<Clock size={24} />}
            color="gray"
          />
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleCompletion={toggleTaskCompletion}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteTask}
              />
            ))
          ) : (
            <div className="bg-white border rounded-lg p-6 text-center text-gray-500">
              Nenhuma tarefa encontrada com os filtros aplicados.
            </div>
          )}
        </div>
      </div>

      <NewEditTaskModal
        isOpen={showNewEditModal}
        onClose={() => setShowNewEditModal(false)}
        initialData={selectedTask}
      />
    </>
  );
}
