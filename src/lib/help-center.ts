import {
  Calendar,
  CheckSquare,
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Search,
  Settings,
  Shield,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type HelpCategoryKey =
  | 'onboarding'
  | 'dashboard'
  | 'configuracoes'
  | 'membros'
  | 'assinatura'
  | 'atendimento'
  | 'vendas'
  | 'leads'
  | 'kanban'
  | 'agenda'
  | 'metas'
  | 'marketing'
  | 'projetos'
  | 'os'
  | 'tarefas'
  | 'faq';

export interface HelpCategory {
  key: HelpCategoryKey;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  category: HelpCategoryKey;
  videoUrl?: string;
  planHint?: string;
  steps: string[];
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
}

export const helpCategories: HelpCategory[] = [
  {
    key: 'onboarding',
    title: 'Onboarding',
    description: 'Primeiros passos e visão geral do MDS CRM.',
    icon: HelpCircle,
  },
  {
    key: 'dashboard',
    title: 'Dashboard',
    description: 'Entenda os indicadores principais da operação.',
    icon: LayoutDashboard,
  },
  {
    key: 'configuracoes',
    title: 'Configurações',
    description: 'Canais, widget, equipes e agentes.',
    icon: Settings,
  },
  {
    key: 'membros',
    title: 'Membros',
    description: 'Convites, usuários e permissões.',
    icon: Shield,
  },
  {
    key: 'assinatura',
    title: 'Assinatura',
    description: 'Planos, upgrade, downgrade e limites.',
    icon: CreditCard,
  },
  {
    key: 'atendimento',
    title: 'Atendimento',
    description: 'Conversas, caixas de entrada, agentes e contatos.',
    icon: MessageSquare,
  },
  {
    key: 'vendas',
    title: 'Vendas',
    description: 'Fluxo comercial, rotina e acompanhamento.',
    icon: Target,
  },
  {
    key: 'leads',
    title: 'Leads',
    description: 'Cadastro, importação, filtros e follow-ups.',
    icon: Users,
  },
  {
    key: 'kanban',
    title: 'Kanban',
    description: 'Etapas, movimentação, tags e follow-ups.',
    icon: FolderKanban,
  },
  {
    key: 'agenda',
    title: 'Agenda',
    description: 'Eventos, compromissos e Pomodoro.',
    icon: Calendar,
  },
  {
    key: 'metas',
    title: 'Metas',
    description: 'Criação, edição e acompanhamento de objetivos.',
    icon: Target,
  },
  {
    key: 'marketing',
    title: 'Marketing',
    description: 'Projetos, OS e tarefas operacionais.',
    icon: Megaphone,
  },
  {
    key: 'projetos',
    title: 'Projetos',
    description: 'Gestão dos projetos da operação.',
    icon: FolderKanban,
  },
  {
    key: 'os',
    title: 'Ordens de Serviço',
    description: 'Criação, edição e busca de OS.',
    icon: CheckSquare,
  },
  {
    key: 'tarefas',
    title: 'Tarefas',
    description: 'Criar, editar, buscar e concluir tarefas.',
    icon: CheckSquare,
  },
  {
    key: 'faq',
    title: 'Dúvidas Frequentes',
    description: 'Respostas rápidas para problemas comuns.',
    icon: Search,
  },
];

export const helpArticles: HelpArticle[] = [
  {
    slug: 'visao-geral-do-sistema',
    title: 'Visão geral do sistema',
    description: 'Entenda como Atendimento, Vendas, Marketing e Configurações se conectam no MDS CRM.',
    category: 'onboarding',
    steps: [
      'Acesse o Dashboard para ter uma visão inicial da operação.',
      'Configure os canais de atendimento antes de iniciar a rotina comercial.',
      'Cadastre ou importe leads para alimentar o funil de vendas.',
      'Use o Kanban para acompanhar o avanço das oportunidades.',
      'Crie follow-ups, tarefas e eventos para manter a operação organizada.',
    ],
    faqs: [
      {
        question: 'Preciso configurar tudo antes de usar?',
        answer: 'Não. O recomendado é começar por canais, membros e leads. Os demais módulos podem ser ativados conforme a maturidade da operação.',
      },
    ],
  },
  {
    slug: 'primeiros-passos',
    title: 'Primeiros passos no MDS CRM',
    description: 'Sequência recomendada para começar a operar o CRM com segurança.',
    category: 'onboarding',
    steps: [
      'Revise os dados da empresa e da conta.',
      'Convide os membros da equipe.',
      'Configure permissões por perfil de usuário.',
      'Conecte os canais de atendimento disponíveis no seu plano.',
      'Crie os primeiros leads e acompanhe pelo Kanban.',
    ],
  },
  {
    slug: 'entender-dashboard',
    title: 'Como interpretar o Dashboard',
    description: 'Veja como usar o Dashboard para acompanhar indicadores e gargalos da operação.',
    category: 'dashboard',
    steps: [
      'Acesse o menu Dashboard.',
      'Observe os indicadores principais exibidos no topo da tela.',
      'Use os filtros disponíveis para analisar períodos específicos.',
      'Compare os números com a rotina de atendimento, vendas e tarefas.',
      'Use os dados como apoio para priorizar ações comerciais.',
    ],
  },
  {
    slug: 'configurar-whatsapp-evolution',
    title: 'Configurar WhatsApp via Evolution',
    description: 'Oriente a conexão operacional do WhatsApp Business no Atendimento.',
    category: 'configuracoes',
    planHint: 'Alguns recursos de canais podem depender do plano contratado.',
    steps: [
      'Acesse Configurações e depois Atendimento.',
      'Selecione a opção de configurar canal WhatsApp Business.',
      'Informe os dados solicitados pela tela.',
      'Conecte a instância seguindo as instruções de QR Code ou status do canal.',
      'Valide se a caixa de entrada ficou disponível no Atendimento.',
    ],
  },
  {
    slug: 'configurar-whatsapp-oficial',
    title: 'Configurar WhatsApp Oficial',
    description: 'Entenda o caminho para operar com API Oficial do WhatsApp.',
    category: 'configuracoes',
    planHint: 'A API Oficial costuma estar disponível em planos superiores ou mediante configuração assistida.',
    steps: [
      'Acesse Configurações e depois Atendimento.',
      'Escolha a opção de WhatsApp Oficial quando disponível no seu plano.',
      'Confira os dados exigidos para ativação do canal.',
      'Valide o status do canal após a configuração.',
      'Teste envio e recebimento antes de colocar a operação em produção.',
    ],
  },
  {
    slug: 'configurar-widget',
    title: 'Configurar Widget de atendimento',
    description: 'Configure o widget para captação e atendimento via site.',
    category: 'configuracoes',
    steps: [
      'Acesse Configurações de Atendimento.',
      'Localize a área de Widget.',
      'Revise nome, aparência e canais disponíveis.',
      'Copie o código ou instrução de instalação gerada pelo sistema.',
      'Instale no site e realize um teste de contato.',
    ],
  },
  {
    slug: 'configurar-equipes-agentes',
    title: 'Configurar equipes e agentes',
    description: 'Organize a distribuição de conversas entre usuários e times.',
    category: 'configuracoes',
    steps: [
      'Acesse Configurações de Atendimento.',
      'Crie ou revise as equipes existentes.',
      'Adicione os agentes responsáveis por cada área.',
      'Relacione agentes às caixas de entrada corretas.',
      'Faça um teste transferindo uma conversa entre agentes ou equipes.',
    ],
  },
  {
    slug: 'convidar-membro',
    title: 'Convidar membro',
    description: 'Adicione novos usuários à organização.',
    category: 'membros',
    steps: [
      'Acesse Configurações e depois Membros.',
      'Clique em convidar novo membro.',
      'Informe nome, email e perfil do usuário.',
      'Envie o convite.',
      'Peça para o usuário aceitar o convite e concluir o acesso.',
    ],
  },
  {
    slug: 'configurar-permissoes',
    title: 'Configurar permissões',
    description: 'Defina o que cada membro pode visualizar e operar.',
    category: 'membros',
    steps: [
      'Acesse Configurações e depois Membros.',
      'Selecione o membro que deseja ajustar.',
      'Revise o perfil do usuário e os módulos liberados.',
      'Salve as alterações.',
      'Peça para o usuário atualizar a tela ou entrar novamente se necessário.',
    ],
  },
  {
    slug: 'upgrade-downgrade-planos',
    title: 'Upgrade e downgrade de planos',
    description: 'Entenda como alterar o plano da sua assinatura.',
    category: 'assinatura',
    planHint: 'Recursos avançados podem ser desbloqueados em planos superiores.',
    steps: [
      'Acesse Configurações e depois Assinatura.',
      'Revise o plano atual e seus limites.',
      'Compare os planos disponíveis.',
      'Escolha upgrade ou downgrade conforme a necessidade da operação.',
      'Confirme a alteração e valide se os recursos foram atualizados.',
    ],
  },
  {
    slug: 'visao-geral-atendimento',
    title: 'Visão geral do Atendimento',
    description: 'Entenda como operar conversas, contatos, caixas de entrada, agentes e equipes.',
    category: 'atendimento',
    steps: [
      'Acesse o menu Atendimento.',
      'Selecione a caixa de entrada desejada.',
      'Abra uma conversa para visualizar o histórico.',
      'Envie e receba mensagens diretamente pela tela de Atendimento.',
      'Use atribuição, transferência e encerramento para controlar a rotina.',
    ],
  },
  {
    slug: 'selecionar-caixa-enviar-mensagem',
    title: 'Selecionar caixa de entrada e enviar mensagens',
    description: 'Use as caixas de entrada para separar canais e conversas.',
    category: 'atendimento',
    steps: [
      'Acesse Atendimento.',
      'Selecione a caixa de entrada desejada.',
      'Clique na conversa que deseja responder.',
      'Digite a mensagem no campo de envio.',
      'Envie e confirme se a resposta apareceu no histórico.',
    ],
  },
  {
    slug: 'atribuir-encerrar-conversas',
    title: 'Atribuir e encerrar conversas',
    description: 'Organize responsabilidades e finalize atendimentos concluídos.',
    category: 'atendimento',
    steps: [
      'Abra uma conversa no Atendimento.',
      'Verifique o responsável atual.',
      'Atribua a conversa ao agente correto.',
      'Após finalizar o atendimento, marque a conversa como encerrada.',
      'Reabra a conversa se o cliente retornar e a operação exigir continuidade.',
    ],
  },
  {
    slug: 'gerenciar-contatos-atendimento',
    title: 'Gerenciar contatos pelo Atendimento',
    description: 'Edite, bloqueie ou inicie contato com clientes pelo Atendimento.',
    category: 'atendimento',
    steps: [
      'Acesse Atendimento.',
      'Abra a conversa do contato desejado.',
      'Revise os dados do contato.',
      'Edite informações quando necessário.',
      'Use bloqueio apenas quando fizer sentido para a operação.',
    ],
  },
  {
    slug: 'visao-geral-vendas',
    title: 'Visão geral de Vendas',
    description: 'Entenda como Leads, Kanban, Agenda, Follow-ups e Metas se conectam.',
    category: 'vendas',
    steps: [
      'Use Leads para cadastrar oportunidades.',
      'Use Kanban para acompanhar a etapa comercial.',
      'Use Follow-ups para não perder retornos.',
      'Use Agenda para compromissos com data e horário.',
      'Use Metas para acompanhar objetivos comerciais.',
    ],
  },
  {
    slug: 'criar-editar-excluir-lead',
    title: 'Criar, editar e excluir Lead',
    description: 'Gerencie o cadastro individual de oportunidades comerciais.',
    category: 'leads',
    steps: [
      'Acesse o menu Leads.',
      'Clique em criar novo Lead.',
      'Preencha os dados disponíveis.',
      'Salve o cadastro.',
      'Para editar ou excluir, abra o Lead e use as opções disponíveis na tela.',
    ],
  },
  {
    slug: 'importar-leads',
    title: 'Importar Leads',
    description: 'Importe listas comerciais para acelerar a prospecção.',
    category: 'leads',
    steps: [
      'Acesse Leads.',
      'Clique em importar lista ou importar CSV.',
      'Selecione o arquivo de importação.',
      'Revise o mapeamento dos campos.',
      'Conclua a importação e confira se os Leads aparecem na listagem.',
    ],
  },
  {
    slug: 'buscar-leads-filtros',
    title: 'Buscar Leads por filtros',
    description: 'Use filtros para localizar oportunidades específicas.',
    category: 'leads',
    steps: [
      'Acesse Leads.',
      'Use o campo de busca para procurar por nome, empresa ou contato.',
      'Aplique filtros disponíveis na tela.',
      'Combine filtros para refinar a lista.',
      'Limpe os filtros para voltar à visão completa.',
    ],
  },
  {
    slug: 'acoes-em-massa-leads',
    title: 'Ações em massa em Leads',
    description: 'Envie Leads para o Kanban ou exclua registros em lote quando disponível.',
    category: 'leads',
    steps: [
      'Acesse Leads.',
      'Selecione os registros desejados.',
      'Escolha a ação em massa disponível.',
      'Confirme a operação.',
      'Revise o resultado na listagem ou no Kanban.',
    ],
  },
  {
    slug: 'criar-follow-up',
    title: 'Criar Follow-up',
    description: 'Programe retornos comerciais vinculados ao Lead.',
    category: 'leads',
    steps: [
      'Abra o Lead desejado.',
      'Clique na opção de criar Follow-up.',
      'Informe título, descrição, data e horário.',
      'Defina o responsável quando disponível.',
      'Salve e acompanhe pela Central de Follow-ups ou Agenda.',
    ],
  },
  {
    slug: 'configurar-estagios-kanban',
    title: 'Criar, editar e excluir estágios do Kanban',
    description: 'Ajuste as etapas do processo comercial.',
    category: 'kanban',
    steps: [
      'Acesse Kanban.',
      'Localize a área de estágios ou colunas.',
      'Crie uma nova etapa quando necessário.',
      'Edite nome ou ordem das etapas conforme o processo comercial.',
      'Exclua apenas etapas que não prejudicam a operação atual.',
    ],
  },
  {
    slug: 'editar-lead-kanban',
    title: 'Editar Lead pelo Kanban',
    description: 'Atualize dados comerciais sem sair da visão do funil.',
    category: 'kanban',
    steps: [
      'Acesse Kanban.',
      'Clique no card do Lead.',
      'Abra a opção de edição.',
      'Atualize os dados necessários.',
      'Salve e valide se o card manteve a etapa correta.',
    ],
  },
  {
    slug: 'adicionar-tags-kanban',
    title: 'Adicionar Tags pelo Kanban',
    description: 'Classifique oportunidades diretamente no funil comercial.',
    category: 'kanban',
    steps: [
      'Acesse Kanban.',
      'Abra o Lead desejado.',
      'Localize a área de tags.',
      'Adicione ou remova tags conforme a segmentação.',
      'Salve as alterações.',
    ],
  },
  {
    slug: 'agenda-criar-editar-excluir-evento',
    title: 'Criar, editar e excluir evento',
    description: 'Organize compromissos comerciais e operacionais na Agenda.',
    category: 'agenda',
    steps: [
      'Acesse Agenda.',
      'Clique para criar um novo evento.',
      'Informe título, data, horário e responsável.',
      'Salve o evento.',
      'Para editar ou excluir, abra o evento e use as opções disponíveis.',
    ],
  },
  {
    slug: 'usar-pomodoro',
    title: 'Usar Pomodoro',
    description: 'Use ciclos de foco para organizar execução e produtividade.',
    category: 'agenda',
    steps: [
      'Acesse Agenda.',
      'Localize a função Pomodoro quando disponível.',
      'Inicie um ciclo de foco.',
      'Execute a tarefa durante o tempo definido.',
      'Finalize ou reinicie o ciclo conforme a rotina.',
    ],
  },
  {
    slug: 'criar-editar-excluir-meta',
    title: 'Criar, editar e excluir Meta',
    description: 'Cadastre objetivos e acompanhe o progresso da equipe.',
    category: 'metas',
    steps: [
      'Acesse Metas.',
      'Clique em Nova Meta.',
      'Preencha título, categoria, prazo e objetivo.',
      'Salve a meta.',
      'Abra a meta para editar, acompanhar ou excluir quando necessário.',
    ],
  },
  {
    slug: 'visao-geral-marketing',
    title: 'Visão geral de Marketing',
    description: 'Entenda como Projetos, OS e Tarefas ajudam na execução operacional.',
    category: 'marketing',
    steps: [
      'Use Projetos para organizar entregas maiores.',
      'Use OS para formalizar demandas operacionais.',
      'Use Tarefas para distribuir execução.',
      'Acompanhe responsáveis e prazos.',
      'Revise a operação com frequência para evitar gargalos.',
    ],
  },
  {
    slug: 'gerenciar-projetos',
    title: 'Criar, editar, excluir e buscar Projetos',
    description: 'Organize projetos internos e entregas para clientes.',
    category: 'projetos',
    steps: [
      'Acesse Projetos.',
      'Crie um novo projeto.',
      'Informe dados principais e responsável.',
      'Use a busca para localizar projetos existentes.',
      'Edite ou exclua conforme necessidade operacional.',
    ],
  },
  {
    slug: 'gerenciar-os',
    title: 'Criar, editar, excluir e buscar OS',
    description: 'Controle ordens de serviço da operação.',
    category: 'os',
    steps: [
      'Acesse OS.',
      'Crie uma nova ordem de serviço.',
      'Informe cliente, projeto, responsável e descrição.',
      'Use busca e filtros para localizar OS existentes.',
      'Edite ou exclua quando necessário.',
    ],
  },
  {
    slug: 'gerenciar-tarefas',
    title: 'Criar, editar, excluir e buscar Tarefas',
    description: 'Distribua atividades e acompanhe execução diária.',
    category: 'tarefas',
    steps: [
      'Acesse Tarefas.',
      'Crie uma nova tarefa.',
      'Defina responsável, prazo e prioridade.',
      'Use busca e filtros para localizar tarefas.',
      'Conclua, edite ou exclua conforme o andamento.',
    ],
  },
  {
    slug: 'duvidas-frequentes',
    title: 'Dúvidas frequentes',
    description: 'Respostas rápidas para problemas comuns da operação.',
    category: 'faq',
    steps: [
      'Identifique o módulo relacionado à dúvida.',
      'Use a busca da Central de Ajuda.',
      'Leia o tutorial correspondente.',
      'Verifique se o recurso depende de plano ou permissão.',
      'Acione o suporte se o problema persistir.',
    ],
    faqs: [
      {
        question: 'Por que não vejo um módulo no menu?',
        answer: 'O módulo pode depender de permissão do usuário ou do plano contratado pela organização.',
      },
      {
        question: 'Por que um recurso aparece na ajuda, mas não aparece na minha conta?',
        answer: 'Alguns recursos podem estar disponíveis apenas em planos superiores ou precisam ser configurados pelo administrador.',
      },
      {
        question: 'Posso usar a Central de Ajuda sem ser administrador?',
        answer: 'Sim. A Central de Ajuda foi criada para orientar todos os usuários logados.',
      },
    ],
  },
];

export function getCategoryByKey(key: HelpCategoryKey) {
  return helpCategories.find((category) => category.key === key);
}

export function getArticleBySlug(slug: string) {
  return helpArticles.find((article) => article.slug === slug);
}

export function getArticlesByCategory(category: HelpCategoryKey) {
  return helpArticles.filter((article) => article.category === category);
}

export function searchHelpArticles(query: string) {
  const term = query.trim().toLowerCase();

  if (!term) return helpArticles;

  return helpArticles.filter((article) => {
    const category = getCategoryByKey(article.category);
    const searchable = [
      article.title,
      article.description,
      category?.title ?? '',
      ...article.steps,
      ...(article.faqs?.flatMap((faq) => [faq.question, faq.answer]) ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(term);
  });
}
