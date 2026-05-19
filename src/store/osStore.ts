// src/store/osStore.ts
// Store de Ordens de Serviço — Zustand com API
import { create } from 'zustand';
import { OS, OSStage, ServiceOrderAPI, mapApiToOS, mapOSToApi, PilaresMDS, ChecklistItem } from '@/types/os';
import axios from 'axios';

// ============================================
// TEMPLATE DE CHECKLIST PARA IMPLANTAÇÃO MDS
// ============================================

const createMDSTemplate = (): PilaresMDS => ({
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

// ============================================
// INTERFACE DA STORE
// ============================================

interface OSStore {
  // Estado
  ordens: OS[];
  loading: boolean;
  error: string | null;

  // CRUD via API
  fetchOS: (filters?: { search?: string; status?: string; type?: string }) => Promise<void>;
  addOS: (os: Omit<OS, 'id' | 'codigo'>) => Promise<OS>;
  updateOS: (id: number | string, updates: Partial<OS>) => Promise<void>;
  deleteOS: (id: number | string) => Promise<void>;

  // Stages da OS (local — sem persistência no banco por enquanto)
  osStages: OSStage[];
  addOSStage: (stage: Omit<OSStage, 'id'>) => void;
  updateOSStage: (id: string, updates: Partial<OSStage>) => void;
  deleteOSStage: (id: string) => void;
  reorderOSStages: (newOrder: OSStage[]) => void;

  // Column order no kanban (local)
  osColumnOrder: Record<string, (number | string)[]>;
  setOSColumnOrder: (order: Record<string, (number | string)[]>) => void;
  moveOSInColumns: (osId: number | string, fromStage: string, toStage: string, newIndex: number) => void;

  // Helpers
  getOSByProject: (projectId: number | string) => OS[];
  calculateProgress: (osId: number | string) => number;
  recalculateAndSetOSProgress: (osId: number | string) => void;

  // Rebuild column order a partir das OS carregadas
  rebuildColumnOrder: () => void;
}

// ============================================
// STORE
// ============================================

export const useOSStore = create<OSStore>((set, get) => ({
  // Estado inicial
  ordens: [],
  loading: false,
  error: null,

  osStages: [
    { id: 'em_planejamento', title: 'Em Planejamento', order: 0, color: 'blue' },
    { id: 'em_execucao', title: 'Em Execução', order: 1, color: 'orange' },
    { id: 'aguardando_cliente', title: 'Aguardando Cliente', order: 2, color: 'yellow' },
    { id: 'concluida', title: 'Concluída', order: 3, color: 'green' },
    { id: 'cancelada', title: 'Cancelada', order: 4, color: 'red' },
  ],

  osColumnOrder: {
    em_planejamento: [],
    em_execucao: [],
    aguardando_cliente: [],
    concluida: [],
    cancelada: [],
  },

  // ==========================================
  // CRUD VIA API
  // ==========================================

  /**
   * Buscar ordens de serviço da API
   */
  fetchOS: async (filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.type) params.set('type', filters.type);
      params.set('limit', '200'); // Buscar todas para o kanban

      const response = await axios.get(`/api/os?${params.toString()}`);
      const { serviceOrders } = response.data;

      // Mapear API → tipo OS da UI
      const ordens: OS[] = (serviceOrders || []).map((api: ServiceOrderAPI) => mapApiToOS(api));

      set({ ordens, loading: false });

      // Reconstruir column order para o kanban
      get().rebuildColumnOrder();
    } catch (error: any) {
      console.error('[osStore] Erro ao buscar OS:', error);
      set({
        error: error.response?.data?.error || 'Erro ao carregar ordens de serviço',
        loading: false,
      });
    }
  },

  /**
   * Criar nova OS via API
   */
  addOS: async (osData) => {
    set({ loading: true, error: null });
    try {
      // Se for implantação MDS, aplicar template
      const pilares = osData.tipo === 'implantacao_mds' ? createMDSTemplate() : osData.pilares;

      // Mapear campos da UI para a API
      const apiData = mapOSToApi({ ...osData, pilares });

      const response = await axios.post('/api/os', apiData);
      const newOS = mapApiToOS(response.data);

      set((state) => ({
        ordens: [newOS, ...state.ordens],
        loading: false,
        osColumnOrder: {
          ...state.osColumnOrder,
          [newOS.status]: [newOS.id, ...(state.osColumnOrder[newOS.status] || [])],
        },
      }));

      return newOS;
    } catch (error: any) {
      console.error('[osStore] Erro ao criar OS:', error);
      set({
        error: error.response?.data?.error || 'Erro ao criar ordem de serviço',
        loading: false,
      });
      throw error;
    }
  },

  /**
   * Atualizar OS via API
   */
  updateOS: async (id, updates) => {
    const prevOS = get().ordens.find((o) => String(o.id) === String(id));
    if (!prevOS) return;

    // Atualização otimista na UI
    set((state) => ({
      ordens: state.ordens.map((o) =>
        String(o.id) === String(id) ? { ...o, ...updates } : o
      ),
    }));

    try {
      const apiData = mapOSToApi(updates);
      const response = await axios.put(`/api/os/${id}`, apiData);
      const updatedOS = mapApiToOS(response.data);

      set((state) => {
        let newColumnOrder = { ...state.osColumnOrder };

        // Se mudou de status, atualizar colunas do kanban
        if (updates.status && updates.status !== prevOS.status) {
          newColumnOrder[prevOS.status] = (newColumnOrder[prevOS.status] || []).filter(
            (osId) => String(osId) !== String(id)
          );
          newColumnOrder[updates.status] = [
            ...(newColumnOrder[updates.status] || []),
            id,
          ];
        }

        return {
          ordens: state.ordens.map((o) =>
            String(o.id) === String(id) ? updatedOS : o
          ),
          osColumnOrder: newColumnOrder,
        };
      });
    } catch (error: any) {
      console.error('[osStore] Erro ao atualizar OS:', error);
      // Reverter atualização otimista
      set((state) => ({
        ordens: state.ordens.map((o) =>
          String(o.id) === String(id) ? prevOS : o
        ),
        error: error.response?.data?.error || 'Erro ao atualizar ordem de serviço',
      }));
    }
  },

  /**
   * Excluir OS via API
   */
  deleteOS: async (id) => {
    const os = get().ordens.find((o) => String(o.id) === String(id));
    if (!os) return;

    // Remoção otimista
    set((state) => ({
      ordens: state.ordens.filter((o) => String(o.id) !== String(id)),
      osColumnOrder: {
        ...state.osColumnOrder,
        [os.status]: (state.osColumnOrder[os.status] || []).filter(
          (osId) => String(osId) !== String(id)
        ),
      },
    }));

    try {
      await axios.delete(`/api/os/${id}`);
    } catch (error: any) {
      console.error('[osStore] Erro ao excluir OS:', error);
      // Reverter remoção otimista
      set((state) => ({
        ordens: [...state.ordens, os],
        osColumnOrder: {
          ...state.osColumnOrder,
          [os.status]: [...(state.osColumnOrder[os.status] || []), os.id],
        },
        error: error.response?.data?.error || 'Erro ao excluir ordem de serviço',
      }));
    }
  },

  // ==========================================
  // STAGES (LOCAL)
  // ==========================================

  addOSStage: (stageData) => {
    const newStage: OSStage = {
      ...stageData,
      id: `stage_${Date.now()}`,
    };
    set((state) => ({
      osStages: [...state.osStages, newStage].sort((a, b) => a.order - b.order),
      osColumnOrder: {
        ...state.osColumnOrder,
        [newStage.id]: [],
      },
    }));
  },

  updateOSStage: (id, updates) => {
    set((state) => ({
      osStages: state.osStages.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteOSStage: (id) => {
    const state = get();
    if (state.osStages.length <= 1) return;
    if ((state.osColumnOrder[id] || []).length > 0) {
      alert('Não é possível excluir um estágio que contém OS. Mova as OS primeiro.');
      return;
    }

    set((state) => {
      const newColumnOrder = { ...state.osColumnOrder };
      delete newColumnOrder[id];
      return {
        osStages: state.osStages.filter((s) => s.id !== id),
        osColumnOrder: newColumnOrder,
      };
    });
  },

  reorderOSStages: (newOrder) => {
    set({ osStages: newOrder.map((stage, index) => ({ ...stage, order: index })) });
  },

  // ==========================================
  // KANBAN COLUMN ORDER
  // ==========================================

  setOSColumnOrder: (order) => set({ osColumnOrder: order }),

  moveOSInColumns: (osId, fromStage, toStage, newIndex) => {
    set((state) => {
      const newColumnOrder = { ...state.osColumnOrder };

      // Remover da coluna de origem
      newColumnOrder[fromStage] = (newColumnOrder[fromStage] || []).filter(
        (id) => String(id) !== String(osId)
      );

      // Inserir na coluna de destino
      const destColumn = [...(newColumnOrder[toStage] || [])];
      destColumn.splice(newIndex, 0, osId);
      newColumnOrder[toStage] = destColumn;

      return {
        osColumnOrder: newColumnOrder,
        ordens:
          fromStage !== toStage
            ? state.ordens.map((o) =>
                String(o.id) === String(osId) ? { ...o, status: toStage } : o
              )
            : state.ordens,
      };
    });

    // Se mudou de coluna, persistir no banco
    if (fromStage !== toStage) {
      axios.put(`/api/os/${osId}`, { status: toStage }).catch((err) => {
        console.error('[osStore] Erro ao mover OS no kanban:', err);
      });
    }
  },

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Reconstruir order das colunas a partir das OS carregadas
   */
  rebuildColumnOrder: () => {
    const { ordens, osStages } = get();
    const newColumnOrder: Record<string, (number | string)[]> = {};

    // Inicializar todas as colunas
    osStages.forEach((stage) => {
      newColumnOrder[stage.id] = [];
    });

    // Distribuir OS nas colunas pelo status
    ordens.forEach((os) => {
      if (newColumnOrder[os.status]) {
        newColumnOrder[os.status].push(os.id);
      } else {
        // Se o status não tem coluna, colocar na primeira
        const firstStage = osStages[0]?.id || 'em_planejamento';
        if (!newColumnOrder[firstStage]) newColumnOrder[firstStage] = [];
        newColumnOrder[firstStage].push(os.id);
      }
    });

    set({ osColumnOrder: newColumnOrder });
  },

  getOSByProject: (projectId) => {
    return get().ordens.filter((o) => String(o.projetoId) === String(projectId));
  },

  calculateProgress: (osId) => {
    const os = get().ordens.find((o) => String(o.id) === String(osId));
    if (!os || !os.pilares) return 0;

    // Coletar todos os checklists de todos os pilares
    const allChecklists: ChecklistItem[] = [];

    try {
      if (os.pilares.benchmarking?.checklist) allChecklists.push(...os.pilares.benchmarking.checklist);
      if (os.pilares.planejamento?.checklist) allChecklists.push(...os.pilares.planejamento.checklist);
      if (os.pilares.canais?.instagram?.checklist) allChecklists.push(...os.pilares.canais.instagram.checklist);
      if (os.pilares.canais?.facebook?.checklist) allChecklists.push(...os.pilares.canais.facebook.checklist);
      if (os.pilares.canais?.gmb?.checklist) allChecklists.push(...os.pilares.canais.gmb.checklist);
      if (os.pilares.canais?.whatsapp?.checklist) allChecklists.push(...os.pilares.canais.whatsapp.checklist);
      if (os.pilares.canais?.site?.checklist) allChecklists.push(...os.pilares.canais.site.checklist);
      if (os.pilares.canais?.metaAds?.checklist) allChecklists.push(...os.pilares.canais.metaAds.checklist);
      if (os.pilares.canais?.googleAds?.checklist) allChecklists.push(...os.pilares.canais.googleAds.checklist);
      if (os.pilares.dadosGCAO?.checklist) allChecklists.push(...os.pilares.dadosGCAO.checklist);
      if (os.pilares.segmentacao?.checklist) allChecklists.push(...os.pilares.segmentacao.checklist);
      if (os.pilares.fidelizacao?.checklist) allChecklists.push(...os.pilares.fidelizacao.checklist);
    } catch {
      return os.progresso || 0;
    }

    if (allChecklists.length === 0) return os.progresso || 0;

    const completed = allChecklists.filter((item) => item.done).length;
    return Math.round((completed / allChecklists.length) * 100);
  },

  recalculateAndSetOSProgress: (osId) => {
    const progress = get().calculateProgress(osId);
    // Atualizar apenas localmente por performance
    set((state) => ({
      ordens: state.ordens.map((o) =>
        String(o.id) === String(osId) ? { ...o, progresso: progress } : o
      ),
    }));
  },
}));
