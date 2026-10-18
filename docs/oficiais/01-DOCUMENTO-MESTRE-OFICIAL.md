DOCUMENTO MESTRE OFICIAL — MDS CRM SaaS
VERSÃO OFICIAL — MAIO 2026
IDENTIDADE DO PROJETO
Nome Oficial

MDS CRM SaaS

Empresa

Mundo Digital Soluções

Objetivo do Produto

O MDS CRM SaaS é uma plataforma de marketing, vendas e atendimento criada para pequenas e médias empresas com foco operacional e comercial.

O sistema foi projetado para centralizar:

Atendimento
Leads
Pipeline comercial
Agenda
Follow-ups
Tarefas
Marketing
OS
Relatórios
Integrações
Multiatendimento
OBJETIVO CENTRAL DO MVP

O MVP comercial possui foco prioritário em:

Atendimento
Leads
Pipeline Comercial
Follow-up
Agenda operacional
Integração Atendimento ↔ CRM
WhatsApp multi-provider
Multiatendimento
Estabilidade operacional
REGRA MÃE DO PROJETO
É PROIBIDO GERAR REGRESSÃO

Toda alteração deve obrigatoriamente:

preservar funcionalidades já validadas;
preservar integrações homologadas;
preservar estabilidade operacional;
preservar fluxos do Atendimento;
preservar providers;
preservar sincronizações.

É proibido:

refatorar sem necessidade;
alterar comportamento sem evidência;
modificar core protegido sem rollback;
alterar provider misturando canais;
alterar Atendimento sem validação;
substituir arquitetura estável por hipótese.

Toda mudança exige:

impacto mapeado;
risco identificado;
rollback definido;
validação local;
validação operacional.
VISÃO OFICIAL DO PRODUTO

O CRM NÃO é apenas um CRM tradicional.

O produto é uma plataforma operacional integrada entre:

Atendimento
Marketing
Comercial
Execução
Relacionamento
Gestão
METODOLOGIA OFICIAL — MÉTODO MDS

O sistema foi estruturado baseado no Método MDS.

Pilar 1 — Benchmarking

Análise de mercado, concorrência e posicionamento.

Pilar 2 — Planejamento Estratégico

Estruturação comercial, operacional e marketing.

Pilar 3 — Canais de Aquisição

Captação de leads e geração de oportunidades.

Pilar 4 — Gestão de Dados (GCAO)

Geração, coleta, análise e otimização.

Pilar 5 — Segmentação de Leads

Organização por listas e segmentações personalizadas.

Pilar 6 — Fidelização

Relacionamento e retenção de clientes.

ARQUITETURA OFICIAL
REGRA CENTRAL

O Atendimento é o backend operacional oficial do sistema.

O CRM NÃO substitui o Atendimento.

O CRM:

orquestra;
sincroniza;
integra;
controla permissões;
controla contexto comercial;
conecta Leads e Vendas.

A operação de mensagens pertence ao Atendimento.

STACK OFICIAL
Frontend
Next.js App Router
React
TypeScript strict
TailwindCSS
Backend
Next.js API Routes
Prisma ORM
PostgreSQL
Auth
NextAuth
Infraestrutura
Docker
VPS Hostinger KVM
Coolify
GitHub
MULTI-TENANT

Toda entidade operacional possui:

organizationId

Toda operação deve respeitar:

isolamento organizacional;
permissões;
segregação de dados;
contexto da organização.
PROVIDERS OFICIAIS
Provider 1

WhatsApp Business via Evolution API

Provider 2

WhatsApp API Oficial via Meta Cloud API

REGRA FIXA DOS PROVIDERS
1 número
1 inbox

1 canal operacional

Nunca misturar providers no mesmo canal.

REGRA DE ISOLAMENTO

Providers NÃO podem compartilhar:

inbox;
webhook;
sessão;
autenticação;
lifecycle;
reconexão;
fila operacional.
CHATWOOT — ESTADO OFICIAL
IMPLEMENTADO

Já existe:

autenticação;
API helper;
webhook;
sincronização;
equipes;
agentes;
inboxes;
cache local;
notificações;
bridge Atendimento ↔ Leads.
WEBHOOK OFICIAL

Webhook operacional:

/api/webhooks/chatwoot

Fluxo:

Chatwoot
→ webhook CRM
→ resolve organização
→ processa evento
→ sincroniza CRM

BRIDGE ATENDIMENTO ↔ LEADS
IMPLEMENTADO

Funções:

criação automática de Lead;
atualização automática;
vínculo de conversa;
vínculo de inbox;
atividades automáticas;
notificações;
sincronização operacional.
MULTIAGENTE
IMPLEMENTADO PARCIALMENTE

Já existe:

equipes;
membros;
inbox members;
sincronização de agentes;
vínculo CRM ↔ Atendimento.
MODELAGEM OPERACIONAL
Estruturas principais
Comercial
Lead
LeadPipelineStage
Tags
Activities
Atendimento
ChatwootConversation
WhatsappInstance
Gestão
Task
AgendaEvent
Goal
ServiceOrder
Integrações
ConnectedAccount
Webhook
WebhookLog
LEADS
IMPLEMENTADO

Lead já possui integração operacional com Atendimento.

Campos integrados:

chatwootContactId
chatwootConversationId
chatwootInboxId
PIPELINE COMERCIAL
IMPLEMENTADO

Estrutura:

Lead
Pipeline
Activities
Tags
Agenda
Tasks
SEGMENTAÇÃO COMERCIAL
IMPLEMENTADO

Estruturas:

Tag
LeadTag

Objetivos:

listas segmentadas;
campanhas futuras;
automações comerciais;
organização comercial.
TASKS
IMPLEMENTADO

Já suporta:

recorrência;
lead;
projeto;
responsável;
subtasks.
AGENDA
IMPLEMENTADO

Já suporta:

lead;
projeto;
recorrência;
lembretes;
responsável.
ORDENS DE SERVIÇO
IMPLEMENTADO

Estrutura:

ServiceOrder

Objetivos:

operação interna;
execução;
acompanhamento.
NOTIFICAÇÕES
IMPLEMENTADO

Estrutura:

Notification

Integrado parcialmente ao Atendimento.

WEBHOOKS EXTERNOS
IMPLEMENTADO

Estruturas:

Webhook
WebhookLog

Objetivos:

integrações externas;
automações futuras;
APIs externas.
CORE PROTEGIDO

Arquivos críticos:

src/app/(app)/atendimento/page.tsx
src/app/api/integrations/chatwoot/credentials/route.ts

Mudanças:

somente com impacto mapeado;
somente com rollback;
somente com validação operacional.
FLUXO OFICIAL DE GIT
REGRA FIXA

git push NÃO publica.

Fluxo oficial:

git add
git commit
git push
deploy manual no Coolify
COOLIFY

Deploy:

manual;
controlado;
sem auto publish.
DIRETRIZ OFICIAL DE EVOLUÇÃO

Toda evolução futura deve priorizar:

estabilidade;
Atendimento;
Vendas;
providers;
prevenção de regressão;
desacoplamento seguro;
validação operacional.
PRIORIDADE OFICIAL DO MVP
PRIORIDADE MÁXIMA
Atendimento
Vendas
Providers
Estabilidade
PRIORIDADE MÉDIA
Automação
Relatórios
Segmentação
PRIORIDADE FUTURA
IA operacional
Analytics avançado
Campanhas automatizadas
Fluxos inteligentes
ARQUITETURA-ALVO FUTURA

Objetivos futuros:

providers totalmente isolados;
onboarding unificado;
Hub de Integrações consolidado;
follow-up automático;
analytics operacional;
IA operacional;
automações comerciais;
filas avançadas.
DIRETRIZ OPERACIONAL DOS AGENTES

Todo agente deve:

trabalhar 1 passo por vez;
evitar hipótese;
evitar refactor desnecessário;
preservar estabilidade;
validar impacto antes de alterar;
respeitar core protegido;
respeitar providers;
respeitar arquitetura oficial.
STATUS GERAL — MAIO 2026
ESTÁVEL
Atendimento base
Webhook
Leads
Multi-tenant
Prisma
Pipeline
Agenda
Tasks
Notificações
Integração Chatwoot
PARCIAL
Multiagente avançado
Cloud API
Isolamento total de providers
Hub de Integrações
CRÍTICO
impedir regressão;
preservar Atendimento;
preservar providers;
preservar integrações homologadas.
VISÃO ESTRATÉGICA DO PRODUTO

O MDS CRM SaaS foi criado para unir:

Marketing
Atendimento
Comercial
Operação
Gestão
Relacionamento

em uma única plataforma operacional integrada para PMEs.

SNAPSHOT OFICIAL
Fatos
Atendimento é backend operacional oficial.
Chatwoot está integrado operacionalmente.
Leads já sincronizam com Atendimento.
Multiagente já existe parcialmente.
Existe início real de isolamento de providers.
Cloud API já possui estrutura dedicada inicial.
Riscos prioritários
regressão operacional;
mistura de providers;
refactor destrutivo;
alteração indevida do core protegido.
Diretriz oficial

Toda alteração deve priorizar:

estabilidade;
continuidade operacional;
proteção do que já está validado.