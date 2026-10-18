MAPA DE DEPENDÊNCIAS — MDS CRM SaaS
MAPA OFICIAL DE IMPACTO E DEPENDÊNCIAS
STATUS OFICIAL — MAIO 2026
OBJETIVO DO DOCUMENTO

Este documento define as principais dependências entre módulos, fluxos, tabelas, providers e integrações do MDS CRM SaaS.

Objetivo principal:

impedir regressão;
prever impacto antes de alterar;
evitar alterações cegas;
proteger fluxos já validados;
orientar agentes e desenvolvedores.
REGRA MÃE
NENHUMA ALTERAÇÃO SEM MAPEAR DEPENDÊNCIA

Antes de alterar qualquer módulo, validar:

quais tabelas são afetadas;
quais APIs são afetadas;
quais telas são afetadas;
quais providers são afetados;
quais fluxos operacionais podem quebrar;
qual rollback será usado.
VISÃO GERAL DAS DEPENDÊNCIAS

O sistema possui dependências principais entre:

Organização
Usuários
Atendimento
Leads
Pipeline
Follow-up
Tasks
Agenda
Providers
Webhooks
Notificações
Billing
Permissões
DEPENDÊNCIA CENTRAL — ORGANIZATION
Entidade base

Organization

Depende de

Nenhuma entidade operacional deve existir fora de uma organização.

Afeta
Users
Leads
Atendimento
WhatsApp
Pipeline
Agenda
Tasks
OS
Goals
ConnectedAccount
Webhooks
Billing
Risco

Alterar organizationId ou queries sem escopo causa:

vazamento entre tenants;
perda de dados;
quebra SaaS;
falha de segurança.
Regra

Toda query deve respeitar:

organizationId
tenant atual
permissões
USERS / MEMBROS
Entidade base

User

Depende de
Organization
Auth
Permissões
Afeta
Atendimento multiagente
Assignee
Tasks
Agenda
Leads
OS
Notifications
Permissões
Campos sensíveis
organizationId
role
permissions
chatwootUserId
isChatwootAgent
atendimentoVisibility
Risco

Alterar usuário pode quebrar:

login;
permissões;
atendimento multiagente;
vínculos com tarefas;
responsáveis comerciais.
AUTH / NEXTAUTH
Depende de
User
Organization
Session
Afeta
todo o sistema;
permissões;
multi-tenant;
APIs protegidas.
Risco

Alterar Auth pode quebrar:

login;
sessão;
organização ativa;
acesso ao CRM;
APIs internas.
ATENDIMENTO
Depende de
Chatwoot
ConnectedAccount
User
Organization
Webhook
Providers
ChatwootConversation
Afeta
Leads
Pipeline
Notifications
Tasks
Agenda
Multiagente
Providers
Arquivos críticos
src/app/(app)/atendimento/page.tsx
src/app/api/integrations/chatwoot/credentials/route.ts
src/lib/chatwoot.ts
src/lib/atendimento/orchestration/*
Risco

Alterar Atendimento pode quebrar:

operação principal;
iframe;
webhook;
sync;
multiagente;
bridge com leads.
CHATWOOT API HELPER
Arquivo

src/lib/chatwoot.ts

Depende de
ConnectedAccount
Token criptografado
Organization
Chatwoot API
Afeta
agentes;
equipes;
inboxes;
webhook;
credenciais;
multiagente;
integração operacional.
Risco

Alteração global aqui pode quebrar todo Atendimento.

CONNECTED ACCOUNT
Entidade base

ConnectedAccount

Depende de
Organization
OAuth / tokens
Providers externos
Afeta
Chatwoot
Meta Ads
Google Ads
Google Meu Negócio
integrações externas
Campos sensíveis
provider
accessTokenEnc
refreshTokenEnc
data
isActive
Risco

Alterar estrutura ou leitura de token pode quebrar integrações.

WEBHOOK CHATWOOT
Arquivo

src/app/api/webhooks/chatwoot/route.ts

Depende de
CHATWOOT_WEBHOOK_SECRET
Chatwoot payload
resolveOrganizationIdForChatwootAccount
processChatwootEvent
Afeta
Lead
ChatwootConversation
Notifications
Activities
Providers
Risco

Erro aqui causa:

perda de eventos;
duplicação;
falha de sync;
inconsistência comercial.
CHATWOOT EVENTS
Arquivo

src/lib/atendimento/orchestration/chatwoot-events.ts

Depende de
payload do Chatwoot
organização
inbox
provider
lead-bridge
WhatsApp Cloud outbound
Afeta
providers
lead-bridge
outbound
sincronização
cache local
Risco

Alteração sem filtro correto pode:

misturar providers;
reprocessar mensagens;
duplicar eventos;
quebrar outbound.
LEAD BRIDGE
Arquivo

src/lib/atendimento/orchestration/lead-bridge.ts

Depende de
Chatwoot payload
Lead
ChatwootConversation
Activity
Notification
User
Organization
Afeta
Leads
Pipeline
histórico comercial
notificações
Atendimento
Risco

Alterar pode causar:

leads duplicados;
leads sem vínculo;
atividades ausentes;
notificações incorretas;
conversas sem lead.
LEADS
Entidade base

Lead

Depende de
Organization
User
Atendimento
Pipeline
Tags
Tasks
Agenda
Activities
Afeta
Kanban
Follow-up
Tasks
Agenda
Atendimento
Relatórios
Segmentação
Campos sensíveis
name
status
score
inKanban
chatwootContactId
chatwootConversationId
chatwootInboxId
Riscos atuais
nome obrigatório trava listas reais;
score obrigatório indevido;
status desalinhado do Kanban;
lead não aparece no pipeline.
IMPORTAÇÃO CSV
Depende de
Lead
validação de campos
pipeline padrão
organizationId
normalização de dados
Afeta
Leads
Kanban
Segmentação
onboarding comercial
Riscos atuais
CSV inconsistente;
nome obrigatório bloqueando importação;
leads não entrando no Kanban;
dados incompletos em listas reais.
Regra

Importação deve aceitar lead sem nome e gerar fallback:

Lead sem nome
PIPELINE / KANBAN
Depende de
Lead
LeadPipelineStage
status
inKanban
Activities
Tasks
Afeta
vendas;
follow-up;
dashboard;
filtros;
relatórios.
Riscos atuais
status e etapa desalinhados;
lead criado não entra corretamente;
edição pelo Kanban gera erro;
update parcial falha.
Regra

Pipeline e status devem ser sincronizados.

LEAD PIPELINE STAGE
Entidade base

LeadPipelineStage

Depende de
Organization
Lead
Afeta
Kanban
filtros
visão comercial
Risco

Alterar stages pode quebrar:

status visual;
ordenação;
filtros;
movimentação do Kanban.
TAGS / SEGMENTAÇÃO
Entidades
Tag
LeadTag
Depende de
Organization
Lead
Afeta
listas;
segmentação;
campanhas futuras;
filtros.
Risco

Alterar pode quebrar segmentação comercial.

FOLLOW-UP
Depende de
Lead
Task
Agenda
Activity
User
Organization
Afeta
rotina comercial;
tarefas;
agenda;
drawer do lead;
histórico.
Riscos atuais
follow-up não permite horário;
tarefa criada não aparece vinculada;
relacionamento incompleto.
Regra

Follow-up deve gerar vínculo claro com:

lead;
task;
data;
horário;
responsável.
TASKS
Entidade base

Task

Depende de
Organization
Lead
Project
User
Agenda
Follow-up
Afeta
agenda;
drawer do lead;
rotina comercial;
filtros;
notificações.
Riscos atuais
filtro “Hoje” incorreto;
task de follow-up não aparece no lead;
timezone pode afetar datas.
Regra

Task deve sempre respeitar:

organizationId;
leadId;
assignedToId;
dueDate;
timezone operacional.
AGENDA
Entidade base

AgendaEvent

Depende de
Organization
Lead
User
Project
Task / Follow-up
Afeta
tarefas;
follow-up;
rotina comercial;
dashboard;
notificações.
Riscos atuais
editar evento retorna “Evento não encontrado”;
vínculo pode estar quebrado;
query pode não estar respeitando organizationId;
id pode estar divergente.
Regra

Evento deve ser editável e preservar relacionamento.

ACTIVITIES
Entidade base

Activity

Depende de
Lead
User
Project
Atendimento
Afeta
histórico comercial;
timeline;
auditoria;
drawer do lead.
Risco

Alterar activity pode quebrar rastreabilidade.

NOTIFICATIONS
Entidade base

Notification

Depende de
User
Atendimento
Lead
Task
Agenda
Afeta
alertas;
operação diária;
acompanhamento comercial.
Risco

Alterar pode gerar ruído ou ausência de alertas.

WHATSAPP INSTANCE
Entidade base

WhatsappInstance

Depende de
Organization
Provider
Atendimento
Chatwoot Inbox
Evolution API
Cloud API
Afeta
providers;
inbox;
webhook;
outbound;
status;
lifecycle.
Campos sensíveis
instanceName
phoneNumber
status
chatwootInboxId
serverUrl
metadata
isActive
Risco

Alterar pode:

misturar provider;
perder inbox;
quebrar status;
quebrar reconexão.
EVOLUTION API
Depende de
WhatsappInstance
Atendimento
Chatwoot Inbox
API Evolution
webhook / lifecycle
Afeta
WhatsApp Business;
atendimento operacional;
inbox;
mensagens;
conexão.
Risco

Alterar pode derrubar WhatsApp operacional.

WHATSAPP CLOUD API
Depende de
WhatsappInstance
metadata.provider
phoneNumberId
accessToken
Chatwoot Inbox
Meta Graph API
Afeta
outbound;
inbound futuro;
lifecycle;
onboarding;
Atendimento.
Risco

Alterar pode:

misturar Cloud com Evolution;
quebrar outbound;
gerar loop;
enviar mensagem indevida.
WEBHOOKS EXTERNOS
Entidades
Webhook
WebhookLog
Depende de
Organization
integrações externas
eventos do CRM
Afeta
automações;
n8n;
integrações;
auditoria.
Risco

Alterar pode quebrar automações futuras.

BILLING / PLANOS
Entidades
Plan
Coupon
Organization
Depende de
Asaas
Subscription
Trial
Limits
Afeta
usuários;
limites;
acesso;
features;
cobrança.
Risco

Alterar pode:

liberar acesso indevido;
bloquear cliente;
quebrar trial;
quebrar cobrança.
PERMISSÕES
Depende de
User
Role
permissions
organizationId
Afeta
acesso ao sistema;
Atendimento;
Vendas;
configurações;
integrações.
Risco

Alterar pode gerar:

acesso indevido;
bloqueio indevido;
vazamento entre usuários.
RELATÓRIOS
Depende de
Leads
Activities
Tasks
Agenda
Atendimento
Pipeline
Providers
Afeta
análise comercial;
dashboard;
métricas.
Risco

Relatório errado gera decisão operacional errada.

ORDEM DE IMPACTO ANTES DE ALTERAR

Antes de alterar qualquer arquivo, responder:

Isso toca Atendimento?
Isso toca provider?
Isso toca webhook?
Isso toca Lead?
Isso toca Kanban?
Isso toca Task?
Isso toca Agenda?
Isso toca multi-tenant?
Isso toca auth?
Existe rollback?
ZONAS DE MAIOR RISCO
Risco máximo
Atendimento
Webhook
Providers
Multi-tenant
Auth
Risco alto
Leads
Pipeline
Follow-up
Tasks
Agenda
Risco médio
Relatórios
Notificações
Segmentação
Billing
REGRA DE VALIDAÇÃO POR ÁREA
Se mexer em Lead

Validar:

criação;
edição;
importação;
Kanban;
drawer;
pipeline.
Se mexer em Kanban

Validar:

status;
etapa;
drag;
edição;
filtros.
Se mexer em Follow-up

Validar:

data;
horário;
task;
lead drawer;
agenda.
Se mexer em Task

Validar:

filtro Hoje;
vínculo com lead;
responsável;
datas.
Se mexer em Agenda

Validar:

criação;
edição;
vínculo;
filtros.
Se mexer em Provider

Validar:

provider correto;
inbox correta;
status;
outbound;
lifecycle.
Se mexer em Atendimento

Validar:

iframe;
webhook;
SSO;
sync;
multiagente.
SNAPSHOT OFICIAL
Regra principal

Nenhuma alteração sem mapa de dependência.

Maior risco atual

Regressão lateral em módulos conectados.

Objetivo atual

Corrigir bugs operacionais reais sem quebrar fluxos validados.