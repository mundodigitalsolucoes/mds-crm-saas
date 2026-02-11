import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard | MDS CRM',
  description: 'Painel principal do CRM com métricas em tempo real.',
};

export default async function DashboardPage() {
  // ─── Autenticação ───
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect('/auth/login');
  }

  const orgId = session.user.organizationId;

  // ─── Filtro seguro para Tasks (não tem organizationId direto) ───
  // Pega tarefas onde o responsável OU o criador pertence à organização
  const taskOrgFilter = {
    OR: [
      { assignedTo: { organizationId: orgId } },
      { createdBy: { organizationId: orgId } },
    ],
  };

  // ─── Consultas paralelas ao banco ───
  const [
    totalLeadsCount,
    activeProjectsCount,
    pendingTasksCount,
    wonLeadsCount,
    recentLeads,
    todaysTasks,
  ] = await Promise.all([
    // 1. Total de Leads da organização
    prisma.lead.count({
      where: { organizationId: orgId },
    }),

    // 2. Projetos Ativos da organização
    prisma.marketingProject.count({
      where: {
        organizationId: orgId,
        status: 'active',
      },
    }),

    // 3. Tarefas Pendentes (via usuários da org)
    prisma.task.count({
      where: {
        ...taskOrgFilter,
        status: { notIn: ['done', 'cancelled'] },
      },
    }),

    // 4. Leads Ganhos (para taxa de conversão)
    prisma.lead.count({
      where: {
        organizationId: orgId,
        status: 'won',
      },
    }),

    // 5. Leads Recentes (últimos 5)
    prisma.lead.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        company: true,
        status: true,
      },
    }),

    // 6. Tarefas de Hoje (via usuários da org)
    prisma.task.findMany({
      where: {
        ...taskOrgFilter,
        dueDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { notIn: ['done', 'cancelled'] },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      include: {
        assignedTo: { select: { name: true } },
      },
    }),
  ]);

  // ─── Cálculos ───
  const conversionRate =
    totalLeadsCount > 0
      ? ((wonLeadsCount / totalLeadsCount) * 100).toFixed(1)
      : '0.0';

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      new: 'Novo',
      contacted: 'Contactado',
      qualified: 'Qualificado',
      proposal: 'Proposta',
      negotiation: 'Negociação',
      won: 'Ganho',
      lost: 'Perdido',
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-indigo-100 text-indigo-800',
      proposal: 'bg-purple-100 text-purple-800',
      negotiation: 'bg-orange-100 text-orange-800',
      won: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // ─── Renderização ───
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">Dados em tempo real</span>
      </div>

      {/* GRID DE CARDS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card Leads */}
        <div className="bg-white rounded-lg shadow p-6 transition-transform hover:scale-105">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{totalLeadsCount}</p>
            </div>
          </div>
        </div>

        {/* Card Projetos */}
        <div className="bg-white rounded-lg shadow p-6 transition-transform hover:scale-105">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Projetos Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{activeProjectsCount}</p>
            </div>
          </div>
        </div>

        {/* Card Tarefas */}
        <div className="bg-white rounded-lg shadow p-6 transition-transform hover:scale-105">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tarefas Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">{pendingTasksCount}</p>
            </div>
          </div>
        </div>

        {/* Card Conversões */}
        <div className="bg-white rounded-lg shadow p-6 transition-transform hover:scale-105">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Taxa Conversão</p>
              <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO SECUNDÁRIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Leads Recentes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Leads Recentes</h2>
          </div>
          {recentLeads.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="p-4 flex justify-between items-center hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    <p className="text-sm text-gray-500">
                      {lead.company || 'Sem empresa'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}
                  >
                    {formatStatus(lead.status)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              Nenhum lead cadastrado ainda.
            </div>
          )}
        </div>

        {/* Lista de Tarefas de Hoje */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tarefas de Hoje</h2>
          </div>
          {todaysTasks.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {todaysTasks.map((task) => (
                <li key={task.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 line-clamp-1">
                        {task.title}
                      </p>
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>
                          {task.assignedTo?.name
                            ? `Resp: ${task.assignedTo.name}`
                            : 'Não atribuído'}
                        </span>
                        <span
                          className={`capitalize ${
                            task.priority === 'urgent'
                              ? 'text-red-600 font-bold'
                              : task.priority === 'high'
                                ? 'text-orange-600'
                                : 'text-gray-500'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              Nenhuma tarefa pendente para hoje.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
