// src/types/os.ts
// Tipos de Ordens de Serviço — MDS CRM

// ============================================
// TIPOS ORIGINAIS (compatibilidade com UI atual)
// ============================================

export type OSStatus = string;

export type OSTipo =
  | 'implantacao_mds'
  | 'campanha_meta_ads'
  | 'campanha_google_ads'
  | 'otimizacao_gmb'
  | 'whatsapp_business'
  | 'seo_local'
  | 'segmentacao_listas'
  | 'fidelizacao'
  | 'outro'
  | 'manutencao'
  | 'custom';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  assignee?: string;
  dueDate?: string;
  evidenceUrl?: string;
  notes?: string;
}

export interface KeywordItem {
  categoria: 'intencao' | 'informativa' | 'localizada' | 'diferencial';
  termo: string;
  volume?: number;
  intencao?: string;
}

export interface SWOT {
  forcas: string[];
  fraquezas: string[];
  oportunidades: string[];
  ameacas: string[];
}

export interface PilaresMDS {
  benchmarking: {
    concorrentes: { tipo: 'direto' | 'indireto' | 'referencia'; nome: string; link?: string }[];
    ambienteLocal?: string;
    checklist: ChecklistItem[];
  };
  planejamento: {
    icpPersonas: string;
    swot: SWOT;
    dores: string[];
    desejos: string[];
    palavrasChave: KeywordItem[];
    checklist: ChecklistItem[];
  };
  canais: {
    selecionados: ('instagram' | 'facebook' | 'gmb' | 'whatsapp' | 'site' | 'meta_ads' | 'google_ads')[];
    instagram: { checklist: ChecklistItem[] };
    facebook: { checklist: ChecklistItem[] };
    gmb: { checklist: ChecklistItem[] };
    whatsapp: { checklist: ChecklistItem[] };
    site: { checklist: ChecklistItem[] };
    metaAds: { estrutura?: string; checklist: ChecklistItem[] };
    googleAds: { estrutura?: string; checklist: ChecklistItem[] };
  };
  dadosGCAO: {
    ciclos: {
      ciclo: number;
      gerar: string;
      coletar: string;
      analisar: string;
      otimizar: string;
      metricas: { ctr?: number; cpa?: number; roas?: number; leads?: number };
    }[];
    checklist: ChecklistItem[];
  };
  segmentacao: {
    listas: { tipo: 'novos' | 'frequentes' | 'inativos' | 'interesse' | 'aniversario'; regra: string }[];
    funis: { segmento: string; etapas: string[]; oferta?: string }[];
    checklist: ChecklistItem[];
  };
  fidelizacao: {
    programa: { regras: string; recompensas: string; niveis?: string };
    comunidade?: string;
    nps?: string;
    indicacao?: string;
    checklist: ChecklistItem[];
  };
}

export interface OSStage {
  id: string;
  title: string;
  order: number;
  color: string;
}

// ============================================
// TIPO PRINCIPAL (COMPATÍVEL COM API + UI)
// ============================================

export interface OS {
  // ID pode ser number (legado) ou string (UUID da API)
  id: number | string;
  codigo: string;
  titulo: string;
  descricao?: string;
  projetoId?: number | string;
  leadId?: number | string;
  cliente?: string;
  tipo: OSTipo;
  status: OSStatus;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  responsavel?: string;
  responsavelId?: string;
  responsavelNome?: string;
  criadoPorId?: string;
  criadoPorNome?: string;
  participantes?: string[];
  datas: {
    abertura: string;
    inicio?: string;
    prazo?: string;
    conclusao?: string;
  };
  objetivos: {
    principal12m: string;
    quadrantes: { q: 1 | 2 | 3 | 4; meta: string }[];
    metasAlvo: {
      leads?: number;
      ctr?: number;
      cpa?: number;
      roas?: number;
      receita?: number;
      ltv?: number;
    };
  };
  orcamento: {
    verbaMidia?: number;
    honorarios?: number;
    moeda?: 'BRL' | 'USD';
  };
  pilares: PilaresMDS;
  anexos?: { nome: string; url: string }[];
  comunicacoes?: {
    data: string;
    autor: string;
    nota: string;
    tipo?: 'cliente' | 'interna';
  }[];
  progresso?: number;
  // Campo do projeto vinculado (vem da API)
  projeto?: { id: string; title: string } | null;
}

// ============================================
// TIPO DA API (como vem do banco)
// ============================================

export interface ServiceOrderAPI {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  description: string | null;
  type: 'implantacao_mds' | 'manutencao' | 'custom';
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  projectId: string | null;
  assignedToId: string | null;
  createdById: string | null;
  pilares: string;
  notes: string | null;
  customFields: string;
  createdAt: string;
  updatedAt: string;
  // Includes
  assignedTo?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
  project?: { id: string; title: string } | null;
}

// ============================================
// MAPPERS: API ↔ UI
// ============================================

// Mapa de prioridade: API (inglês) → UI (português)
const priorityApiToUi: Record<string, OS['prioridade']> = {
  low: 'baixa',
  medium: 'media',
  high: 'alta',
  urgent: 'urgente',
};

const priorityUiToApi: Record<string, string> = {
  baixa: 'low',
  media: 'medium',
  alta: 'high',
  urgente: 'urgent',
};

// Mapa de tipo: API → UI
const typeApiToUi: Record<string, OSTipo> = {
  implantacao_mds: 'implantacao_mds',
  manutencao: 'manutencao',
  custom: 'custom',
};

// Template vazio de pilares (para OS que não são implantação MDS)
const emptyPilares: PilaresMDS = {
  benchmarking: { concorrentes: [], checklist: [] },
  planejamento: {
    icpPersonas: '',
    swot: { forcas: [], fraquezas: [], oportunidades: [], ameacas: [] },
    dores: [],
    desejos: [],
    palavrasChave: [],
    checklist: [],
  },
  canais: {
    selecionados: [],
    instagram: { checklist: [] },
    facebook: { checklist: [] },
    gmb: { checklist: [] },
    whatsapp: { checklist: [] },
    site: { checklist: [] },
    metaAds: { checklist: [] },
    googleAds: { checklist: [] },
  },
  dadosGCAO: { ciclos: [], checklist: [] },
  segmentacao: { listas: [], funis: [], checklist: [] },
  fidelizacao: {
    programa: { regras: '', recompensas: '' },
    checklist: [],
  },
};

/**
 * Converte resposta da API para o tipo OS usado na UI
 */
export function mapApiToOS(api: ServiceOrderAPI): OS {
  let pilares: PilaresMDS;
  try {
    const parsed = typeof api.pilares === 'string' ? JSON.parse(api.pilares) : api.pilares;
    // Verificar se tem estrutura válida de PilaresMDS
    pilares = parsed?.benchmarking ? parsed : emptyPilares;
  } catch {
    pilares = emptyPilares;
  }

  return {
    id: api.id,
    codigo: api.code,
    titulo: api.title,
    descricao: api.description || undefined,
    projetoId: api.projectId || undefined,
    tipo: typeApiToUi[api.type] || 'custom',
    status: api.status,
    prioridade: priorityApiToUi[api.priority] || 'media',
    responsavel: api.assignedTo?.name || undefined,
    responsavelId: api.assignedToId || undefined,
    responsavelNome: api.assignedTo?.name || undefined,
    criadoPorId: api.createdById || undefined,
    criadoPorNome: api.createdBy?.name || undefined,
    datas: {
      abertura: api.createdAt,
      inicio: api.startDate || undefined,
      prazo: api.dueDate || undefined,
      conclusao: api.completedAt || undefined,
    },
    objetivos: {
      principal12m: '',
      quadrantes: [],
      metasAlvo: {},
    },
    orcamento: {},
    pilares,
    progresso: api.progress,
    projeto: api.project || null,
  };
}

/**
 * Converte dados da UI para enviar à API (criar/atualizar)
 */
export function mapOSToApi(os: Partial<OS>): Record<string, any> {
  const data: Record<string, any> = {};

  if (os.titulo !== undefined) data.title = os.titulo;
  if (os.descricao !== undefined) data.description = os.descricao || null;
  if (os.tipo !== undefined) data.type = os.tipo === 'implantacao_mds' ? 'implantacao_mds' : os.tipo === 'manutencao' ? 'manutencao' : 'custom';
  if (os.status !== undefined) data.status = os.status;
  if (os.prioridade !== undefined) data.priority = priorityUiToApi[os.prioridade] || 'medium';
  if (os.progresso !== undefined) data.progress = os.progresso;
  if (os.projetoId !== undefined) data.projectId = os.projetoId ? String(os.projetoId) : null;
  if (os.responsavelId !== undefined) data.assignedToId = os.responsavelId || null;
  if (os.pilares !== undefined) data.pilares = os.pilares;
  if (os.datas?.inicio !== undefined) data.startDate = os.datas.inicio || null;
  if (os.datas?.prazo !== undefined) data.dueDate = os.datas.prazo || null;

  // Notes: combinar de comunicações se existir
  if (os.comunicacoes) {
    data.notes = os.comunicacoes.map(c => `[${c.data}] ${c.autor}: ${c.nota}`).join('\n');
  }

  return data;
}
