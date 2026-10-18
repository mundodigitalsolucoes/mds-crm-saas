ARQUITETURA OFICIAL — MDS CRM SaaS
STATUS OFICIAL — MAIO 2026
REGRA MÃE DO PROJETO
É PROIBIDO GERAR REGRESSÃO

Toda alteração no projeto deve obrigatoriamente:

preservar funcionalidades já validadas;
preservar estabilidade operacional;
preservar integrações já homologadas;
preservar fluxos do Atendimento;
preservar sincronizações entre CRM e Atendimento.

É proibido:

alterar comportamento operacional sem evidência;
refatorar sem necessidade;
modificar fluxo crítico por estética;
alterar core protegido sem rollback;
alterar provider sem isolamento;
misturar providers no mesmo canal;
alterar Atendimento sem validação.

Toda mudança exige:

impacto mapeado;
risco identificado;
rollback definido;
validação local;
validação operacional.
OBJETIVO CENTRAL DO MVP

O MVP comercial possui foco prioritário em:

Atendimento
Leads
Pipeline Comercial
Follow-up
Agenda operacional
Integração Atendimento ↔ CRM
Multiatendimento
WhatsApp multi-provider
Estabilidade operacional
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
VPS Hostinger KVM
Coolify
Docker
GitHub
ARQUITETURA MULTI-TENANT

Toda entidade operacional possui:

organizationId

Toda operação obrigatoriamente deve respeitar:

isolamento organizacional;
permissões;
escopo da organização;
segregação de dados.


- ARQUITETURA OPERACIONAL DO ATENDIMENTO
REGRA OFICIAL

O Atendimento é o backend operacional oficial do CRM.

O CRM NÃO substitui o Atendimento.

O CRM:

orquestra;
sincroniza;
integra;
controla permissões;
controla contexto comercial;
conecta Leads e Vendas.

A operação de mensagens pertence ao Atendimento.

CORE PROTEGIDO

Arquivos críticos protegidos:

src/app/(app)/atendimento/page.tsx
src/app/api/integrations/chatwoot/credentials/route.ts

Mudanças nesses arquivos:

somente com evidência;
impacto mapeado;
rollback definido.
CHATWOOT — ARQUITETURA OFICIAL
IMPLEMENTADO

Integração operacional real com Chatwoot.

Já existe:

autenticação;
API helper;
sync operacional;
webhook;
sincronização de conversas;
sincronização de contatos;
sincronização de inboxes;
sincronização de agentes;
sincronização de equipes;
cache local operacional;
notificações;
bridge Atendimento ↔ Leads.
WEBHOOK OPERACIONAL

Webhook oficial:

/api/webhooks/chatwoot

Fluxo operacional:

Chatwoot
→ webhook CRM
→ resolve organização
→ processa evento
→ sincroniza CRM

Eventos tratados:

message_created
conversation_created
conversation_updated
conversation_status_changed
contact_created
CACHE LOCAL DE CONVERSAS
IMPLEMENTADO

Tabela operacional:

ChatwootConversation

Objetivos:

reduzir dependência de consultas em tempo real;
acelerar interface;
sincronizar contexto operacional;
conectar Atendimento e Leads.

Campos operacionais:

chatwootId
inboxId
assignee
canal
status
unreadCount
lastMessage
lastMessageAt
leadId
BRIDGE ATENDIMENTO ↔ LEADS
IMPLEMENTADO

Arquivo operacional:

src/lib/atendimento/orchestration/lead-bridge.ts

Funções atuais:

criar Lead automaticamente;
atualizar Lead;
sincronizar conversa;
sincronizar inbox;
gerar atividades;
gerar notificações;
sincronizar responsáveis.
MULTIAGENTE
IMPLEMENTADO PARCIALMENTE

Já existe:

equipes;
membros;
inbox members;
sincronização de agentes;
sincronização CRM ↔ Chatwoot.

Campos implementados:

chatwootUserId
isChatwootAgent
atendimentoVisibility

APIs existentes:

/api/atendimento/agentes/sync
/api/atendimento/equipes
/api/atendimento/inboxes/[inboxId]/members
WHATSAPP — ARQUITETURA OFICIAL
REGRA FIXA
1 número
1 inbox

1 canal operacional

Nunca misturar providers no mesmo canal.

PROVIDERS OFICIAIS
Provider 1

WhatsApp Business via Evolution API

Provider 2

WhatsApp API Oficial via Meta Cloud API

REGRA DE ISOLAMENTO DE PROVIDERS

Providers NÃO podem compartilhar:

inbox;
webhook;
autenticação;
sessão;
lifecycle;
reconexão;
fila operacional.
EVOLUTION API
IMPLEMENTADO

Já existe:

gerenciamento de instâncias;
conexão operacional;
sincronização com Atendimento;
integração com inbox operacional;
persistência operacional.
WHATSAPP CLOUD API
IMPLEMENTADO PARCIALMENTE

Já existe:

outbound dedicado;
dispatcher específico;
início de isolamento;
identificação operacional por provider.

Arquivo operacional:

src/lib/atendimento/providers/whatsapp-cloud-outbound.ts
MODELAGEM OPERACIONAL
WhatsappInstance

Tabela oficial operacional dos canais WhatsApp.

Campos principais:

organizationId
instanceName
phoneNumber
status
chatwootInboxId
serverUrl
metadata
isActive
LEADS
IMPLEMENTADO

Lead já possui integração operacional com Atendimento.

Campos integrados:

chatwootContactId
chatwootConversationId
chatwootInboxId
PIPELINE COMERCIAL
IMPLEMENTADO

Estrutura operacional:

Lead
LeadPipelineStage
Tags
Activities
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

Tabela:

AgendaEvent

Já suporta:

lead;
projeto;
recorrência;
lembrete;
responsável.
METAS
IMPLEMENTADO

- Chatwoot White Label

O Chatwoot permanece como motor operacional do Atendimento.

O CRM:

- embute o Chatwoot via iframe;
- controla acesso/contexto;
- integra Atendimento com Leads e Vendas;
- não recria engine de conversa;
- não recria inbox;
- não substitui o Chatwoot.

Customização homologada:

- imagem GHCR própria;
- base compatível com a versão oficial em produção;
- white label por feature flag;
- rollback para imagem oficial preservado.


Estrutura operacional:

Goal
GoalAction
ORDENS DE SERVIÇO
IMPLEMENTADO

Tabela:

ServiceOrder

Objetivos:

operação interna;
execução;
acompanhamento.
NOTIFICAÇÕES
IMPLEMENTADO

Tabela:

Notification

Já integrada parcialmente ao Atendimento.

WEBHOOKS EXTERNOS
IMPLEMENTADO

Estruturas:

Webhook
WebhookLog

Objetivos:

integrações externas;
automações futuras;
APIs externas.
DEPLOY OFICIAL
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
ARQUITETURA-ALVO FUTURA

Objetivos futuros:

providers totalmente isolados;
onboarding unificado;
Hub de Integrações consolidado;
automações comerciais;
follow-up automático;
analytics operacional;
IA operacional;
filas avançadas;
campanhas comerciais.
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
SNAPSHOT OFICIAL
Fatos
Atendimento é backend operacional oficial.
Chatwoot está integrado operacionalmente.
Leads já sincronizam com Atendimento.
Multiagente já existe parcialmente.
Cloud API já possui estrutura inicial dedicada.
Existe isolamento inicial de providers.
Arquivos críticos
src/app/(app)/atendimento/page.tsx
src/app/api/integrations/chatwoot/credentials/route.ts
src/lib/atendimento/orchestration/*
src/lib/chatwoot.ts
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