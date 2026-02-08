import { create } from 'zustand';
import { OS, OSStage } from '@/types/os';


interface OSStore {
  // OS
  ordens: OS[];
  addOS: (os: Omit<OS, 'id'>) => OS; // <- AGORA RETORNA OS
  updateOS: (id: number, updates: Partial<OS>) => void;
  deleteOS: (id: number) => void;

  // Stages da OS
  osStages: OSStage[];
  addOSStage: (stage: Omit<OSStage, 'id'>) => void;
  updateOSStage: (id: string, updates: Partial<OSStage>) => void;
  deleteOSStage: (id: string) => void;
  reorderOSStages: (newOrder: OSStage[]) => void;

  // Column order no kanban
  osColumnOrder: Record<string, number[]>;
  setOSColumnOrder: (order: Record<string, number[]>) => void;
  moveOSInColumns: (osId: number, fromStage: string, toStage: string, newIndex: number) => void;

  // Helpers
  getOSByProject: (projectId: number) => OS[];
  calculateProgress: (osId: number) => number;

  // NOVO: progresso baseado em tarefas vinculadas (usado no taskStore)
  recalculateAndSetOSProgress: (osId: number) => void;
}

// Template de checklist para Implantação MDS
const createMDSTemplate = (): OS['pilares'] => ({
  benchmarking: {
    concorrentes: [],
    ambienteLocal: '',
    checklist: [
      { id: '1', title: 'Identificar concorrentes diretos', done: false },
      { id: '2', title: 'Identificar concorrentes indiretos', done: false },
      { id: '3', title: 'Identificar referências em outras regiões', done: false },
      { id: '4', title: 'Levantar preços e ticket médio', done: false },
      { id: '5', title: 'Analisar qualidade dos produtos/serviços', done: false },
      { id: '6', title: 'Avaliar estratégias de marketing', done: false },
      { id: '7', title: 'Analisar atendimento ao cliente', done: false },
      { id: '8', title: 'Visitar fisicamente (cliente oculto)', done: false },
      { id: '9', title: 'Analisar ambiente local e localização', done: false },
    ],
  },
  planejamento: {
    icpPersonas: '',
    swot: { forcas: [], fraquezas: [], oportunidades: [], ameacas: [] },
    dores: [],
    desejos: [],
    palavrasChave: [],
    checklist: [
      { id: '10', title: 'Definir ICP e Personas', done: false },
      { id: '11', title: 'Realizar análise SWOT', done: false },
      { id: '12', title: 'Identificar dores do cliente', done: false },
      { id: '13', title: 'Identificar desejos do cliente', done: false },
      { id: '14', title: 'Criar mapa de palavras-chave', done: false },
      { id: '15', title: 'Definir metas SMART', done: false },
    ],
  },
  canais: {
    selecionados: [],
    instagram: {
      checklist: [
        { id: '16', title: 'Otimizar nome de usuário', done: false },
        { id: '17', title: 'Configurar foto de perfil (logo)', done: false },
        { id: '18', title: 'Escrever biografia (4 linhas)', done: false },
        { id: '19', title: 'Criar destaques', done: false },
        { id: '20', title: 'Fixar promoções', done: false },
        { id: '21', title: 'Definir Big Idea de conteúdo', done: false },
        { id: '22', title: 'Planejar frequência de posts (3-5/semana)', done: false },
      ],
    },
    facebook: {
      checklist: [
        { id: '23', title: 'Configurar nome da página', done: false },
        { id: '24', title: 'Adicionar foto de perfil', done: false },
        { id: '25', title: 'Criar foto de capa', done: false },
        { id: '26', title: 'Preencher seção "Sobre"', done: false },
        { id: '27', title: 'Configurar horários de funcionamento', done: false },
        { id: '28', title: 'Adicionar botão CTA WhatsApp', done: false },
        { id: '29', title: 'Vincular Instagram e WhatsApp', done: false },
      ],
    },
    gmb: {
      checklist: [
        { id: '30', title: 'Preencher informações básicas', done: false },
        { id: '31', title: 'Adicionar fotos de qualidade', done: false },
        { id: '32', title: 'Escrever descrição da empresa', done: false },
        { id: '33', title: 'Configurar produtos e serviços', done: false },
        { id: '34', title: 'Criar postagens regulares (1-2/semana)', done: false },
        { id: '35', title: 'Configurar FAQ', done: false },
        { id: '36', title: 'Solicitar avaliações', done: false },
        { id: '37', title: 'Otimizar SEO local', done: false },
      ],
    },
    whatsapp: {
      checklist: [
        { id: '38', title: 'Configurar perfil business', done: false },
        { id: '39', title: 'Criar mensagens automatizadas', done: false },
        { id: '40', title: 'Configurar catálogo', done: false },
        { id: '41', title: 'Organizar etiquetas', done: false },
        { id: '42', title: 'Criar listas de transmissão', done: false },
        { id: '43', title: 'Implementar bot com IA', done: false },
      ],
    },
    site: {
      checklist: [
        { id: '44', title: 'Criar landing pages', done: false },
        { id: '45', title: 'Configurar formulários', done: false },
        { id: '46', title: 'Instalar pixels de tracking', done: false },
        { id: '47', title: 'Otimizar para conversão', done: false },
      ],
    },
    metaAds: {
      estrutura: '',
      checklist: [
        { id: '48', title: 'Estruturar campanhas geolocalizadas', done: false },
        { id: '49', title: 'Criar públicos personalizados', done: false },
        { id: '50', title: 'Desenvolver criativos', done: false },
        { id: '51', title: 'Configurar conversões WhatsApp', done: false },
        { id: '52', title: 'Implementar remarketing', done: false },
      ],
    },
    googleAds: {
      estrutura: '',
      checklist: [
        { id: '53', title: 'Criar campanhas de pesquisa local', done: false },
        { id: '54', title: 'Configurar extensões de localização', done: false },
        { id: '55', title: 'Otimizar palavras-chave', done: false },
        { id: '56', title: 'Configurar remarketing', done: false },
      ],
    },
  },
  dadosGCAO: {
    ciclos: [
      { ciclo: 1, gerar: '', coletar: '', analisar: '', otimizar: '', metricas: {} },
      { ciclo: 2, gerar: '', coletar: '', analisar: '', otimizar: '', metricas: {} },
      { ciclo: 3, gerar: '', coletar: '', analisar: '', otimizar: '', metricas: {} },
      { ciclo: 4, gerar: '', coletar: '', analisar: '', otimizar: '', metricas: {} },
    ],
    checklist: [
      { id: '57', title: 'Configurar tracking e pixels', done: false },
      { id: '58', title: 'Implementar CRM', done: false },
      { id: '59', title: 'Definir métricas de acompanhamento', done: false },
      { id: '60', title: 'Criar relatórios automáticos', done: false },
    ],
  },
  segmentacao: {
    listas: [],
    funis: [],
    checklist: [
      { id: '61', title: 'Criar lista de Novos Leads', done: false },
      { id: '62', title: 'Criar lista de Compradores Frequentes', done: false },
      { id: '63', title: 'Criar lista de Clientes Inativos', done: false },
      { id: '64', title: 'Segmentar por interesse', done: false },
      { id: '65', title: 'Configurar segmentação por aniversário', done: false },
      { id: '66', title: 'Criar funis personalizados', done: false },
    ],
  },
  fidelizacao: {
    programa: { regras: '', recompensas: '', niveis: '' },
    comunidade: '',
    nps: '',
    indicacao: '',
    checklist: [
      { id: '67', title: 'Definir programa de fidelidade', done: false },
      { id: '68', title: 'Criar comunidade VIP', done: false },
      { id: '69', title: 'Implementar pesquisa NPS', done: false },
      { id: '70', title: 'Criar campanha de indicação', done: false },
    ],
  },
});

export const useOSStore = create<OSStore>((set, get) => ({
  // Initial data
  ordens: [
    {
      id: 1,
      codigo: 'OS-2026-0001',
      titulo: 'Implantação Método MDS - Empresa Tech',
      projetoId: 1,
      leadId: 1,
      cliente: 'João Silva',
      tipo: 'implantacao_mds',
      status: 'em_planejamento',
      prioridade: 'alta',
      responsavel: 'Fábio Alves',
      participantes: ['Fábio Alves'],
      datas: {
        abertura: '2026-02-03',
        inicio: '2026-02-10',
        prazo: '2026-05-10',
      },
      objetivos: {
        principal12m: 'Aumentar leads qualificados em 200% e receita em 150%',
        quadrantes: [
          { q: 1, meta: 'Organizar presença digital e cadastro de leads' },
          { q: 2, meta: 'Organizar processo de vendas' },
          { q: 3, meta: 'Implementar automação e segmentação' },
          { q: 4, meta: 'Otimizar e escalar resultados' },
        ],
        metasAlvo: {
          leads: 500,
          ctr: 2.5,
          cpa: 25,
          roas: 4,
          receita: 150000,
        },
      },
      orcamento: {
        verbaMidia: 5000,
        honorarios: 8000,
        moeda: 'BRL',
      },
      pilares: createMDSTemplate(),
      progresso: 15,
    },
  ],

  osStages: [
    { id: 'em_planejamento', title: 'Em Planejamento', order: 0, color: 'blue' },
    { id: 'em_execucao', title: 'Em Execução', order: 1, color: 'orange' },
    { id: 'aguardando_cliente', title: 'Aguardando Cliente', order: 2, color: 'yellow' },
    { id: 'concluida', title: 'Concluída', order: 3, color: 'green' },
  ],

  osColumnOrder: {
    em_planejamento: [1],
    em_execucao: [],
    aguardando_cliente: [],
    concluida: [],
  },

  // OS actions
  addOS: (osData) => {
    const nextId = Math.max(...get().ordens.map(o => o.id), 0) + 1;

    const newOS: OS = {
      ...osData,
      id: nextId,
      codigo: `OS-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`,
      pilares: osData.tipo === 'implantacao_mds' ? createMDSTemplate() : osData.pilares,
    };

    set((state) => ({
      ordens: [...state.ordens, newOS],
      osColumnOrder: {
        ...state.osColumnOrder,
        [newOS.status]: [...(state.osColumnOrder[newOS.status] || []), newOS.id],
      },
    }));

    return newOS; // <- RETORNA
  },

  updateOS: (id, updates) => {
    const prevOS = get().ordens.find(o => o.id === id);
    if (!prevOS) return;

    set(state => {
      const updatedOrdens = state.ordens.map(o => o.id === id ? { ...o, ...updates } : o);

      let newColumnOrder = { ...state.osColumnOrder };
      if (updates.status && updates.status !== prevOS.status) {
        newColumnOrder[prevOS.status] = (newColumnOrder[prevOS.status] || []).filter(osId => osId !== id);
        newColumnOrder[updates.status] = [...(newColumnOrder[updates.status] || []), id];
      }

      return {
        ordens: updatedOrdens,
        osColumnOrder: newColumnOrder,
      };
    });
  },

  deleteOS: (id) => {
    const os = get().ordens.find(o => o.id === id);
    if (!os) return;

    set(state => ({
      ordens: state.ordens.filter(o => o.id !== id),
      osColumnOrder: {
        ...state.osColumnOrder,
        [os.status]: (state.osColumnOrder[os.status] || []).filter(osId => osId !== id),
      },
    }));
  },

  // OS Stage actions
  addOSStage: (stageData) => {
    const newStage: OSStage = {
      ...stageData,
      id: `stage_${Date.now()}`,
    };
    set(state => ({
      osStages: [...state.osStages, newStage].sort((a, b) => a.order - b.order),
      osColumnOrder: {
        ...state.osColumnOrder,
        [newStage.id]: [],
      },
    }));
  },

  updateOSStage: (id, updates) => {
    set(state => ({
      osStages: state.osStages.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
  },

  deleteOSStage: (id) => {
    const state = get();

    if (state.osStages.length <= 1) return;
    if ((state.osColumnOrder[id] || []).length > 0) {
      alert('Não é possível excluir um estágio que contém OS. Mova as OS primeiro.');
      return;
    }

    set(state => {
      const newColumnOrder = { ...state.osColumnOrder };
      delete newColumnOrder[id];

      return {
        osStages: state.osStages.filter(s => s.id !== id),
        osColumnOrder: newColumnOrder,
      };
    });
  },

  reorderOSStages: (newOrder) => {
    set({ osStages: newOrder.map((stage, index) => ({ ...stage, order: index })) });
  },

  setOSColumnOrder: (order) => set({ osColumnOrder: order }),

  moveOSInColumns: (osId, fromStage, toStage, newIndex) => {
    set(state => {
      const newColumnOrder = { ...state.osColumnOrder };

      newColumnOrder[fromStage] = (newColumnOrder[fromStage] || []).filter(id => id !== osId);

      const destColumn = [...(newColumnOrder[toStage] || [])];
      destColumn.splice(newIndex, 0, osId);
      newColumnOrder[toStage] = destColumn;

      return {
        osColumnOrder: newColumnOrder,
        ordens: fromStage !== toStage
          ? state.ordens.map(o => o.id === osId ? { ...o, status: toStage } : o)
          : state.ordens,
      };
    });
  },

  // Helpers
  getOSByProject: (projectId) => {
    return get().ordens.filter(o => o.projetoId === projectId);
  },

  calculateProgress: (osId) => {
    const os = get().ordens.find(o => o.id === osId);
    if (!os) return 0;

    const allChecklists = [
      ...os.pilares.benchmarking.checklist,
      ...os.pilares.planejamento.checklist,
      ...os.pilares.canais.instagram.checklist,
      ...os.pilares.canais.facebook.checklist,
      ...os.pilares.canais.gmb.checklist,
      ...os.pilares.canais.whatsapp.checklist,
      ...os.pilares.canais.site.checklist,
      ...os.pilares.canais.metaAds.checklist,
      ...os.pilares.canais.googleAds.checklist,
      ...os.pilares.dadosGCAO.checklist,
      ...os.pilares.segmentacao.checklist,
      ...os.pilares.fidelizacao.checklist,
    ];

    const completed = allChecklists.filter(item => item.done).length;
    return Math.round((completed / allChecklists.length) * 100);
  },

  recalculateAndSetOSProgress: (osId: number) => {
    // Progresso agora é gerenciado manualmente ou via API
    // Esta função é mantida por compatibilidade mas não faz cálculo automático
    console.log('recalculateAndSetOSProgress called for OS:', osId);
  },
}));
