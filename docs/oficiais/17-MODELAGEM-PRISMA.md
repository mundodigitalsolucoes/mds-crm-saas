MODELAGEM PRISMA — MDS CRM SaaS

STATUS OFICIAL — MAIO 2026

--------------------------------------------------

OBJETIVO

Este documento define a modelagem oficial do banco de dados do MDS CRM SaaS.

Objetivos:

- documentar entidades;
- documentar relacionamentos;
- proteger o core do banco;
- reduzir regressão;
- facilitar auditorias;
- facilitar evolução do sistema;
- facilitar onboarding de agentes e desenvolvedores.

--------------------------------------------------

REGRA MÃE

ALTERAÇÃO DE MODELAGEM = ALTERAÇÃO DE ARQUITETURA

Toda alteração em model Prisma deve obrigatoriamente:

- passar pela Fase 1 (Auditoria);
- passar pela Fase 2 (Plano);
- possuir rollback;
- atualizar documentação;
- atualizar CHANGELOG.

--------------------------------------------------

VISÃO GERAL

O banco é dividido em:

1. SaaS Core
2. CRM Comercial
3. Operação
4. Atendimento
5. Marketing
6. Analytics
7. Billing
8. Integrações
9. IA

--------------------------------------------------

SAAS CORE

Responsável por:

- autenticação
- multi-tenant
- planos
- permissões
- onboarding

Modelos:

SuperAdmin
Plan
Organization
Invitation
User
PasswordResetToken

--------------------------------------------------

RELACIONAMENTO PRINCIPAL

Organization
│
├── Users
├── Leads
├── Tasks
├── Projects
├── Goals
├── Tags
├── AgendaEvents
├── WhatsappInstances
├── ConnectedAccounts
├── Webhooks
├── ServiceOrders
├── ChatwootConversations
└── PipelineStages

--------------------------------------------------

CORE PROTEGIDO DO BANCO

ALTERAÇÃO SOMENTE COM AUDITORIA COMPLETA

Modelos protegidos:

Organization
User
Lead
Task
AgendaEvent
ChatwootConversation
ConnectedAccount
WhatsappInstance

Impacto:

Sistema inteiro.

--------------------------------------------------

ORGANIZATION

Responsável por:

- isolamento multi-tenant
- limites do plano
- white-label
- billing

Relacionamentos:

Users
Leads
Projects
Tasks
Goals
AgendaEvents
Tags
Webhooks
ConnectedAccounts
WhatsappInstances
ServiceOrders
ChatwootConversations

Impacto:

Sistema inteiro.

Risco:

CRÍTICO.

--------------------------------------------------

USER

Responsável por:

- autenticação
- permissões
- ownership
- atendimento

Relacionamentos:

Assigned Leads
Created Leads
Assigned Tasks
Created Tasks
Agenda
Goals
Notifications
Chatwoot

Impacto:

CRM
Atendimento
Agenda
Kanban

Risco:

CRÍTICO.

--------------------------------------------------

CRM COMERCIAL

Modelos:

Lead
LeadPipelineStage
Tag
LeadTag

--------------------------------------------------

LEAD

Responsável por:

- CRM
- Pipeline
- Follow-up
- Atendimento
- Dashboard

Relacionamentos:

Lead
│
├── Tasks
├── Activities
├── AgendaEvents
├── ChatwootConversations
└── Tags

Campos críticos:

organizationId
name
status
assignedToId
createdById

Campos comerciais:

email
phone
whatsapp
company
source
score
value

Campos Chatwoot:

chatwootContactId
chatwootConversationId
chatwootInboxId

Impacta:

Leads
Pipeline
Kanban
Follow-up
Agenda
Atendimento

Risco:

CRÍTICO.

--------------------------------------------------

LEAD PIPELINE STAGE

Responsável por:

Pipeline Comercial.

Campos críticos:

organizationId
key
title
order

Impacta:

Pipeline
Kanban

--------------------------------------------------

TAG

Responsável por:

Segmentação Comercial.

Relacionamento:

LeadTag

Impacta:

CRM
Filtros
Automações futuras

--------------------------------------------------

OPERAÇÃO

Modelos:

Task
Subtask
AgendaEvent
Activity
Notification

--------------------------------------------------

TASK

Responsável por:

Follow-up
Central de tarefas
Agenda operacional

Relacionamentos:

Task
│
├── Lead
├── User
├── Project
└── Subtasks

Campos críticos:

organizationId
status
priority
dueDate
assignedToId

Impacta:

Follow-up
Agenda
Dashboard

Risco:

CRÍTICO.

--------------------------------------------------

SUBTASK

Dependente de:

Task

Impacta:

Produtividade
Execução

--------------------------------------------------

AGENDA EVENT

Responsável por:

Agenda Comercial

Relacionamentos:

Lead
Project
Assigned User

Campos críticos:

date
startTime
endTime
status

Impacta:

Agenda
Follow-up
Leads

Risco:

CRÍTICO.

--------------------------------------------------

ACTIVITY

Responsável por:

Histórico operacional.

Impacta:

Auditoria
Timeline

--------------------------------------------------

NOTIFICATION

Responsável por:

Notificações internas.

Impacta:

Usuários
Atendimento

--------------------------------------------------

ATENDIMENTO

Modelos:

ChatwootConversation
ConnectedAccount
WhatsappInstance
Webhook
WebhookLog

--------------------------------------------------

CHATWOOT CONVERSATION

Responsável por:

Cache local do Atendimento.

Relacionamentos:

Lead
Organization
User

Campos críticos:

chatwootId
chatwootInboxId
chatwootContactId
assigneeId

Impacta:

Atendimento

Risco:

CRÍTICO.

--------------------------------------------------

CONNECTED ACCOUNT

Responsável por:

OAuth
Integrações

Exemplos:

Meta
Google
Outros providers

Risco:

CRÍTICO.

--------------------------------------------------

WHATSAPP INSTANCE

Responsável por:

Integração WhatsApp.

Campos críticos:

instanceName
phoneNumber
status
chatwootInboxId

Impacta:

Atendimento
WhatsApp

Risco:

CRÍTICO.

--------------------------------------------------

WEBHOOK

Responsável por:

Integrações externas.

Impacta:

Sistema inteiro.

--------------------------------------------------

WEBHOOK LOG

Responsável por:

Auditoria operacional.

--------------------------------------------------

MARKETING

Modelos:

MarketingProject
KanbanBoard
KanbanColumn
KanbanCard

--------------------------------------------------

MARKETING PROJECT

Responsável por:

Gestão de projetos.

Relacionamentos:

Tasks
Kanban
Agenda
ServiceOrders

--------------------------------------------------

KANBAN BOARD

Relacionamentos:

Board
│
└── Columns

--------------------------------------------------

KANBAN COLUMN

Relacionamentos:

Column
│
└── Cards

--------------------------------------------------

KANBAN CARD

Responsável por:

Execução operacional.

Impacta:

Projetos
Kanban

--------------------------------------------------

METAS

Modelos:

Goal
GoalAction

--------------------------------------------------

GOAL

Responsável por:

Metas comerciais.

Relacionamentos:

GoalActions

--------------------------------------------------

GOAL ACTION

Responsável por:

Plano de execução das metas.

--------------------------------------------------

ANALYTICS

Modelos:

AdsCampaignMetric
GoogleBusinessMetric
AIUsage

--------------------------------------------------

ADS CAMPAIGN METRIC

Responsável por:

Meta Ads
Google Ads

Impacta:

Dashboard

--------------------------------------------------

GOOGLE BUSINESS METRIC

Responsável por:

Google Business Profile.

Impacta:

Relatórios.

--------------------------------------------------

AI USAGE

Responsável por:

Consumo de IA.

Impacta:

Billing futuro
Analytics

--------------------------------------------------

ORDENS DE SERVIÇO

Modelo:

ServiceOrder

--------------------------------------------------

SERVICE ORDER

Responsável por:

Execução operacional.

Relacionamentos:

Project
Assigned User

Impacta:

Projetos
Operação

--------------------------------------------------

BILLING

Modelos:

Plan
Coupon
CouponUsage

--------------------------------------------------

PLAN

Responsável por:

Limites SaaS.

Impacta:

Sistema inteiro.

--------------------------------------------------

COUPON

Responsável por:

Descontos.

--------------------------------------------------

COUPON USAGE

Responsável por:

Controle de utilização.

--------------------------------------------------

MULTI-TENANT

REGRA OBRIGATÓRIA

Toda entidade operacional deve possuir:

organizationId

Toda query deve respeitar:

organizationId

É proibido:

- cross tenant;
- compartilhamento de dados;
- bypass de organização.

--------------------------------------------------

CHECKLIST DE ALTERAÇÃO PRISMA

Ao alterar LEAD:

□ Pipeline

□ Kanban

□ Atendimento

□ Agenda

□ Follow-up

□ Dashboard

--------------------------------------------------

Ao alterar TASK:

□ Follow-up

□ Agenda

□ Dashboard

□ Drawer Lead

--------------------------------------------------

Ao alterar AGENDA EVENT:

□ Agenda

□ Follow-up

□ Lead

--------------------------------------------------

Ao alterar CHATWOOT CONVERSATION:

□ Atendimento

□ Inbox

□ Assignee

□ Lead Bridge

--------------------------------------------------

Ao alterar ORGANIZATION:

□ Multi-tenant

□ Billing

□ Users

□ Providers

□ Atendimento

--------------------------------------------------

REGRA DE DOCUMENTAÇÃO

Toda alteração de model Prisma deve atualizar:

03-LOG-DE-DECISOES

15-CHANGELOG

17-MODELAGEM-PRISMA

--------------------------------------------------

REGRA DE AUDITORIA

Antes de alterar qualquer model:

1. Auditar schema.prisma
2. Auditar dependências
3. Auditar APIs
4. Auditar telas
5. Auditar multi-tenant
6. Definir rollback

--------------------------------------------------

DIRETRIZ FINAL

A modelagem Prisma é o coração do MDS CRM.

Nenhuma alteração estrutural pode ocorrer sem auditoria completa e validação de impacto.

FIM DO DOCUMENTO.