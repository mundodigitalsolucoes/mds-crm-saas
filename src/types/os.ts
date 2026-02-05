export type OSStatus = string; // Dinâmico como no Kanban

export type OSTipo =
  | 'implantacao_mds'
  | 'campanha_meta_ads'
  | 'campanha_google_ads'
  | 'otimizacao_gmb'
  | 'whatsapp_business'
  | 'seo_local'
  | 'segmentacao_listas'
  | 'fidelizacao'
  | 'outro';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  assignee?: string;
  dueDate?: string; // ISO
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

export interface OS {
  id: number;
  codigo: string;
  titulo: string;
  projetoId: number;
  leadId?: number;
  cliente?: string;
  tipo: OSTipo;
  status: OSStatus;
  prioridade: 'baixa' | 'media' | 'alta';
  responsavel?: string;
  participantes?: string[];
  datas: { 
    abertura: string; 
    inicio?: string; 
    prazo?: string; 
    conclusao?: string 
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
      ltv?: number 
    };
  };
  orcamento: { 
    verbaMidia?: number; 
    honorarios?: number; 
    moeda?: 'BRL' | 'USD' 
  };
  pilares: PilaresMDS;
  anexos?: { nome: string; url: string }[];
  comunicacoes?: { 
    data: string; 
    autor: string; 
    nota: string; 
    tipo?: 'cliente' | 'interna' 
  }[];
  progresso?: number; // 0-100
}
