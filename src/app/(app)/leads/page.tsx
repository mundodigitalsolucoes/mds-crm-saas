'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  X,
  Mail,
  Phone,
  MessageCircle,
  Building2,
  MapPin,
  Globe,
  CalendarDays,
  FolderKanban,
  BadgeDollarSign,
  Star,
  Link as LinkIcon,
} from 'lucide-react';
import CSVImport from '@/components/CSVImport';
import NewLeadModal from '@/components/NewLeadModal';
import { useLeadsStore, type Lead, type LeadFilters } from '@/store/leadsStore';
import { usePermission } from '@/hooks/usePermission';
import AccessDenied from '@/components/AccessDenied';
import PermissionLoading from '@/components/PermissionLoading';
import { useUsage } from '@/hooks/useUsage';

function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  selectedCount,
  selectedNames,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  selectedCount: number;
  selectedNames: string[];
}) {
  const [confirmationText, setConfirmationText] = useState('');

  useEffect(() => {
    if (isOpen) setConfirmationText('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isValid = confirmationText === 'EXCLUIR';
  const isSingle = selectedCount === 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-red-600 px-6 py-4">
          <h2 className="text-lg font-bold text-white">
            {isSingle ? 'Confirmar exclusão do lead' : 'Confirmar exclusão em massa'}
          </h2>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg p-1 text-white hover:bg-white/20 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Esta ação é permanente e não poderá ser desfeita.</p>
            <p className="mt-1">
              {isSingle
                ? 'Você está prestes a excluir 1 lead.'
                : `Você está prestes a excluir ${selectedCount} leads.`}
            </p>
          </div>

          {selectedNames.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                {isSingle ? 'Lead selecionado:' : 'Primeiros leads selecionados:'}
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <ul className="space-y-1">
                  {selectedNames.slice(0, 5).map((name, index) => (
                    <li key={`${name}-${index}`} className="truncate">
                      • {name}
                    </li>
                  ))}
                </ul>
                {selectedNames.length > 5 && (
                  <p className="mt-2 text-xs text-gray-500">
                    ... e mais {selectedNames.length - 5} lead(s)
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Para confirmar, digite <span className="font-bold text-red-600">EXCLUIR</span>
            </label>
            <input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Digite EXCLUIR"
              disabled={isDeleting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!isValid || isDeleting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting && <Loader2 size={16} className="animate-spin" />}
              {isSingle ? 'Excluir lead' : 'Excluir selecionados'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function LinkCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-400">—</span>;

  const href = normalizeUrl(value);

  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noreferrer"
      className="inline-block max-w-[180px] truncate text-sm text-indigo-600 hover:underline"
      title={value}
    >
      {value}
    </a>
  );
}

function InfoItem({
  icon,
  label,
  value,
  isLink = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
  isLink?: boolean;
}) {
  if (value === null || value === undefined || value === '') {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          {icon}
          {label}
        </div>
        <div className="text-sm text-gray-400">—</div>
      </div>
    );
  }

  if (isLink && typeof value === 'string') {
    const href = normalizeUrl(value);
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          {icon}
          {label}
        </div>
        <a
          href={href || '#'}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-medium text-indigo-600 hover:underline"
          title={value}
        >
          {value}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="break-words text-sm font-medium text-gray-800">{value}</div>
    </div>
  );
}

function LeadDrawer({
  lead,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onToggleKanban,
  isUpdatingKanban,
}: {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onToggleKanban: (lead: Lead) => void;
  isUpdatingKanban: boolean;
}) {
  if (!isOpen || !lead) return null;

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/35" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">
              Ficha do Lead
            </p>
            <h2 className="mt-1 truncate text-2xl font-bold">{lead.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                {lead.inKanban ? 'No Kanban' : 'Fora do Kanban'}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                Status: {lead.status}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                Score: {lead.score}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white transition hover:bg-white/15"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-gray-200 bg-white px-6 py-4">
          <button
            onClick={() => onEdit(lead)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit size={16} />
            Editar
          </button>

          <button
            onClick={() => onToggleKanban(lead)}
            disabled={isUpdatingKanban}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isUpdatingKanban ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FolderKanban size={16} />
            )}
            {lead.inKanban ? 'Tirar do Kanban' : 'Mandar pro Kanban'}
          </button>

          <button
            onClick={() => onDelete(lead)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Trash2 size={16} />
            Excluir
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InfoItem icon={<Mail size={14} />} label="Email" value={lead.email} />
            <InfoItem icon={<Phone size={14} />} label="Telefone Fixo" value={lead.phone} />
            <InfoItem icon={<MessageCircle size={14} />} label="WhatsApp" value={lead.whatsapp} />
            <InfoItem icon={<Building2 size={14} />} label="Empresa" value={lead.company} />
            <InfoItem icon={<FolderKanban size={14} />} label="Origem" value={lead.source} />
            <InfoItem icon={<Star size={14} />} label="Score" value={lead.score} />
            <InfoItem
              icon={<BadgeDollarSign size={14} />}
              label="Valor"
              value={
                lead.value === null || lead.value === undefined
                  ? null
                  : new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(lead.value)
              }
            />
            <InfoItem icon={<MapPin size={14} />} label="Cidade" value={lead.city} />
            <InfoItem
              icon={<LinkIcon size={14} />}
              label="Produto/Serviço"
              value={lead.productOrService}
            />
            <InfoItem
              icon={<CalendarDays size={14} />}
              label="Criado em"
              value={new Date(lead.createdAt).toLocaleDateString('pt-BR')}
            />
            <InfoItem icon={<Globe size={14} />} label="Site" value={lead.website} isLink />
            <InfoItem icon={<Globe size={14} />} label="Instagram" value={lead.instagram} isLink />
            <InfoItem icon={<Globe size={14} />} label="Facebook" value={lead.facebook} isLink />
            <InfoItem icon={<Globe size={14} />} label="LinkedIn" value={lead.linkedin} isLink />
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Observações
            </p>
            <div className="min-h-[120px] rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {lead.notes?.trim() ? lead.notes : 'Sem observações cadastradas.'}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

const emptyFilters: Omit<LeadFilters, 'search' | 'page'> = {
  status: '',
  source: '',
  city: '',
  inKanban: '',
  hasWhatsapp: '',
  hasWebsite: '',
  minScore: '',
};

export default function LeadsPage() {
  const {
    leads,
    stages,
    isLoading,
    error,
    pagination,
    fetchLeads,
    bulkDeleteLeads,
    updateLead,
  } = useLeadsStore();

  const [showImport, setShowImport] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUpdatingDrawerKanban, setIsUpdatingDrawerKanban] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);

  const { canAccess, isLoading: permLoading } = usePermission();
  const { isAtLimit, isPlanInactive, formatUsage } = useUsage();

  const buildFetchParams = (page = 1): LeadFilters => ({
    search: debouncedSearch,
    status: filters.status || undefined,
    source: filters.source || undefined,
    city: filters.city || undefined,
    inKanban: filters.inKanban || undefined,
    hasWhatsapp: filters.hasWhatsapp || undefined,
    hasWebsite: filters.hasWebsite || undefined,
    minScore: filters.minScore,
    page,
  });

  useEffect(() => {
    fetchLeads(buildFetchParams(1));
  }, [
    debouncedSearch,
    filters.status,
    filters.source,
    filters.city,
    filters.inKanban,
    filters.hasWhatsapp,
    filters.hasWebsite,
    filters.minScore,
    fetchLeads,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => leads.some((lead) => lead.id === id)));
  }, [leads]);

  useEffect(() => {
    if (!drawerLead) return;

    const updatedLeadFromList = leads.find((lead) => lead.id === drawerLead.id);
    if (!updatedLeadFromList) {
      setDrawerLead(null);
      setIsDrawerOpen(false);
      return;
    }

    setDrawerLead(updatedLeadFromList);
  }, [leads, drawerLead]);

  if (permLoading) return <PermissionLoading />;
  if (!canAccess('leads')) return <AccessDenied module="leads" />;

  const limitReached = isAtLimit('leads');
  const planInactive = isPlanInactive();
  const createBlocked = limitReached || planInactive;

  const createTooltip = planInactive
    ? 'Seu período de teste expirou. Entre em contato para continuar.'
    : limitReached
      ? `Limite de leads atingido (${formatUsage('leads')}). Faça upgrade do plano.`
      : '';

  const currentPageLeadIds = useMemo(() => leads.map((lead) => lead.id), [leads]);

  const allSelectedOnPage =
    currentPageLeadIds.length > 0 &&
    currentPageLeadIds.every((id) => selectedLeadIds.includes(id));

  const selectedLeadNames = useMemo(() => {
    const selectedSet = new Set(pendingDeleteIds);
    return leads.filter((lead) => selectedSet.has(lead.id)).map((lead) => lead.name);
  }, [leads, pendingDeleteIds]);

  const openCreateModal = () => {
    if (createBlocked) return;
    setModalMode('create');
    setSelectedLead(null);
    setShowNewLead(true);
  };

  const openEditModal = (lead: Lead) => {
    setModalMode('edit');
    setSelectedLead(lead);
    setShowNewLead(true);
  };

  const openDrawer = (lead: Lead) => {
    setDrawerLead(lead);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerLead(null);
  };

  const openSingleDeleteModal = (lead: Lead) => {
    setPendingDeleteIds([lead.id]);
    setShowDeleteModal(true);
  };

  const handleDeleteFromDrawer = (lead: Lead) => {
    closeDrawer();
    openSingleDeleteModal(lead);
  };

  const handleEditFromDrawer = (lead: Lead) => {
    closeDrawer();
    openEditModal(lead);
  };

  const handleToggleKanbanFromDrawer = async (lead: Lead) => {
    setIsUpdatingDrawerKanban(true);
    const updated = await updateLead(lead.id, { inKanban: !lead.inKanban });
    setIsUpdatingDrawerKanban(false);

    if (updated) {
      setDrawerLead(updated);
    }
  };

  const openBulkDeleteModal = () => {
    if (selectedLeadIds.length === 0) return;
    setPendingDeleteIds(selectedLeadIds);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
    setPendingDeleteIds([]);
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteIds.length === 0) return;

    setIsDeleting(true);
    const deletedCount = await bulkDeleteLeads(pendingDeleteIds, 'EXCLUIR');
    setIsDeleting(false);

    if (deletedCount !== null) {
      setSelectedLeadIds((prev) => prev.filter((id) => !pendingDeleteIds.includes(id)));
      setShowDeleteModal(false);
      setPendingDeleteIds([]);
    }
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setSearchQuery('');
    setDebouncedSearch('');
  };

  const handleImport = async (
    data: any[]
  ): Promise<{ success: number; failed: number; errors: string[] }> => {
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: data }),
      });

      const json = await res.json();

      if (!res.ok) {
        return { success: 0, failed: data.length, errors: [json.error || 'Erro na importação'] };
      }

      fetchLeads(buildFetchParams(1));

      return {
        success: json.sucesso ?? 0,
        failed: json.falhas ?? 0,
        errors: [],
      };
    } catch {
      return { success: 0, failed: data.length, errors: ['Erro de conexão'] };
    }
  };

  const getStatusDisplay = (status: string) => {
    const stage = stages.find((s) => s.id === status);
    return stage?.title || status;
  };

  const getStatusColor = (status: string) => {
    const stage = stages.find((s) => s.id === status);
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
      purple: 'bg-purple-100 text-purple-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return colorMap[stage?.color || 'blue'] || colorMap.blue;
  };

  const getSourceDisplay = (source: string | null) => {
    const sourceMap: Record<string, string> = {
      manual: 'Manual',
      website: 'Website',
      referral: 'Indicação',
      meta_ads: 'Meta Ads',
      google_ads: 'Google Ads',
      chatwoot: 'Chatwoot',
      instagram: 'Instagram',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
      csv_import: 'Importação CSV',
    };
    return sourceMap[source || ''] || source || '—';
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleSelectAllOnPage = () => {
    if (allSelectedOnPage) {
      setSelectedLeadIds((prev) => prev.filter((id) => !currentPageLeadIds.includes(id)));
      return;
    }

    setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...currentPageLeadIds])));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-800">Leads</h1>
        <p className="text-gray-600">Gerencie seus leads e oportunidades de vendas</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{error}</span>
          <button
            onClick={() => fetchLeads(buildFetchParams(pagination.page))}
            className="flex items-center gap-1 font-medium text-red-700 hover:text-red-900"
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      )}

      {selectedLeadIds.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-red-800">{selectedLeadIds.length} lead(s) selecionado(s)</p>
            <p className="text-sm text-red-700">
              A exclusão em massa exige confirmação digitando EXCLUIR.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedLeadIds([])}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Limpar seleção
            </button>
            <button
              onClick={openBulkDeleteModal}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              <Trash2 size={16} />
              Excluir selecionados
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:grid-cols-4 xl:grid-cols-8">
        <div className="xl:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Busca</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Nome, empresa, WhatsApp, cidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Origem</label>
          <select
            value={filters.source}
            onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas</option>
            <option value="manual">Manual</option>
            <option value="website">Website</option>
            <option value="referral">Indicação</option>
            <option value="meta_ads">Meta Ads</option>
            <option value="google_ads">Google Ads</option>
            <option value="chatwoot">Chatwoot</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="csv_import">Importação CSV</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cidade</label>
          <input
            type="text"
            placeholder="Ex: Rio Preto"
            value={filters.city}
            onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">No Kanban</label>
          <select
            value={filters.inKanban}
            onChange={(e) => setFilters((prev) => ({ ...prev, inKanban: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Com WhatsApp</label>
          <select
            value={filters.hasWhatsapp}
            onChange={(e) => setFilters((prev) => ({ ...prev, hasWhatsapp: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="true">Só com WhatsApp</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Com Site</label>
          <select
            value={filters.hasWebsite}
            onChange={(e) => setFilters((prev) => ({ ...prev, hasWebsite: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="true">Só com site</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Score mínimo</label>
          <input
            type="number"
            min="0"
            max="100"
            value={filters.minScore}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                minScore: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <button
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Limpar filtros
          </button>
        </div>

        <div className="flex gap-3">
          <div className="group relative">
            <button
              onClick={() => !createBlocked && setShowImport(true)}
              disabled={createBlocked}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createBlocked ? <AlertTriangle size={18} /> : <Upload size={20} />}
              Importar CSV
            </button>
            {createBlocked && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-center text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {createTooltip}
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>

          <div className="group relative">
            <button
              onClick={openCreateModal}
              disabled={createBlocked}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createBlocked ? <AlertTriangle size={18} /> : <Plus size={20} />}
              Novo Lead
            </button>
            {createBlocked && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-center text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {createTooltip}
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-800">{pagination.total}</p>
        </div>
        {stages.map((stage) => (
          <div key={stage.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-1 truncate text-sm text-gray-600">{stage.title}</p>
            <p className="text-2xl font-bold text-indigo-600">
              {leads.filter((l) => l.status === stage.id).length}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading && leads.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="mr-3 animate-spin text-indigo-600" size={24} />
            <span className="text-gray-600">Carregando leads...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2200px] border-separate border-spacing-0">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-30 border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Selecionar todos os leads da página"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>

                  <th className="sticky left-[49px] z-30 min-w-[220px] border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Nome
                  </th>

                  <th className="min-w-[220px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Email
                  </th>
                  <th className="min-w-[150px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Telefone Fixo
                  </th>
                  <th className="min-w-[150px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    WhatsApp
                  </th>
                  <th className="min-w-[220px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Empresa
                  </th>
                  <th className="min-w-[120px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Status
                  </th>
                  <th className="min-w-[90px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Score
                  </th>
                  <th className="min-w-[140px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Origem
                  </th>
                  <th className="min-w-[120px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Valor
                  </th>
                  <th className="min-w-[220px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Produto/Serviço
                  </th>
                  <th className="min-w-[180px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Cidade
                  </th>
                  <th className="min-w-[180px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Site
                  </th>
                  <th className="min-w-[180px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Instagram
                  </th>
                  <th className="min-w-[180px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Facebook
                  </th>
                  <th className="min-w-[180px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    LinkedIn
                  </th>
                  <th className="min-w-[120px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Data
                  </th>

                  <th className="sticky right-0 z-30 min-w-[170px] border-b border-l border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="group hover:bg-gray-50">
                    <td className="sticky left-0 z-20 border-r border-gray-200 bg-white px-4 py-4 group-hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleSelectLead(lead.id)}
                        aria-label={`Selecionar lead ${lead.name}`}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>

                    <td className="sticky left-[49px] z-20 min-w-[220px] border-r border-gray-200 bg-white px-4 py-4 text-sm font-medium text-gray-800 group-hover:bg-gray-50">
                      <button
                        onClick={() => openDrawer(lead)}
                        className="max-w-[200px] truncate text-left text-indigo-600 hover:underline"
                        title={lead.name}
                      >
                        {lead.name}
                      </button>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-600">{lead.email || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.phone || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.whatsapp || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.company || '—'}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(lead.status)}`}>
                        {getStatusDisplay(lead.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.score}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{getSourceDisplay(lead.source)}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-600">{formatCurrency(lead.value)}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.productOrService || '—'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{lead.city || '—'}</td>
                    <td className="px-4 py-4"><LinkCell value={lead.website} /></td>
                    <td className="px-4 py-4"><LinkCell value={lead.instagram} /></td>
                    <td className="px-4 py-4"><LinkCell value={lead.facebook} /></td>
                    <td className="px-4 py-4"><LinkCell value={lead.linkedin} /></td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                    </td>

                    <td className="sticky right-0 z-20 border-l border-gray-200 bg-white px-4 py-4 group-hover:bg-gray-50">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(lead)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-gray-300 px-3 py-1 text-sm transition-colors hover:bg-gray-50"
                        >
                          <Edit size={14} />
                          Editar
                        </button>
                        <button
                          onClick={() => openSingleDeleteModal(lead)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-700"
                        >
                          <Trash2 size={14} />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!isLoading && leads.length === 0 && (
                  <tr>
                    <td colSpan={18} className="px-6 py-8 text-center text-gray-500">
                      {debouncedSearch ||
                      filters.status ||
                      filters.source ||
                      filters.city ||
                      filters.inKanban ||
                      filters.hasWhatsapp ||
                      filters.hasWebsite ||
                      filters.minScore !== ''
                        ? 'Nenhum lead encontrado para os filtros aplicados.'
                        : 'Nenhum lead cadastrado ainda. Clique em "Novo Lead" para começar.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
            <span className="text-sm text-gray-600">
              Mostrando {leads.length} de {pagination.total} leads
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLeads(buildFetchParams(pagination.page - 1))}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLeads(buildFetchParams(pagination.page + 1))}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {showImport && (
        <CSVImport
          isOpen={true}
          entityName="Leads"
          templateFields={[
            'name',
            'email',
            'phone',
            'whatsapp',
            'company',
            'status',
            'score',
            'source',
            'value',
            'product_or_service',
            'city',
            'website',
            'instagram',
            'facebook',
            'linkedin',
          ]}
          requiredFields={['name']}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      <NewLeadModal
        isOpen={showNewLead}
        onClose={() => {
          setShowNewLead(false);
          setSelectedLead(null);
        }}
        mode={modalMode}
        initialData={selectedLead}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        selectedCount={pendingDeleteIds.length}
        selectedNames={selectedLeadNames}
      />

      <LeadDrawer
        lead={drawerLead}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onEdit={handleEditFromDrawer}
        onDelete={handleDeleteFromDrawer}
        onToggleKanban={handleToggleKanbanFromDrawer}
        isUpdatingKanban={isUpdatingDrawerKanban}
      />
    </div>
  );
}