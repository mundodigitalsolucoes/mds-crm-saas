CHECKLIST DE VALIDAÇÃO — MDS CRM SaaS
CHECKLIST OFICIAL DE VALIDAÇÃO OPERACIONAL
STATUS OFICIAL — MAIO 2026
OBJETIVO DO DOCUMENTO

Este documento define as validações obrigatórias antes de:

commit;
push;
deploy;
merge;
alteração estrutural;
alteração operacional;
alteração em providers;
alteração em Atendimento.

Objetivo principal:

impedir regressão;
preservar estabilidade;
garantir funcionamento do MVP;
evitar quebra operacional.
REGRA MÃE
NENHUMA ALTERAÇÃO SEM VALIDAÇÃO

Nenhuma alteração pode subir sem validar:

build;
TypeScript;
Prisma;
fluxo alterado;
multi-tenant;
providers;
Atendimento;
pipeline;
Leads;
agenda;
tasks.
REGRA OFICIAL

Toda alteração deve responder:

o que foi alterado?
qual área foi impactada?
quais dependências existem?
qual o risco?
qual rollback?
o que foi validado?
CHECKLIST GERAL — OBRIGATÓRIO
1. BUILD
Validar
build completo;
sem erro TypeScript;
sem erro Prisma;
sem erro App Router.
Obrigatório
npm run build
2. TYPESCRIPT
Validar
tipagem;
schemas;
payloads;
rotas.
Objetivo

Evitar:

undefined;
payload quebrado;
runtime error;
validação inconsistente.
3. PRISMA
Validar
schema;
migrations;
relacionamentos;
enums;
organizationId.
Obrigatório
npx prisma validate
4. MULTI-TENANT
Validar
organizationId;
isolamento;
permissões;
queries filtradas.
Nunca permitir
cross-tenant;
vazamento de dados;
query sem organização.
CHECKLIST — ATENDIMENTO
OBRIGATÓRIO SE MEXER NO ATENDIMENTO
Validar
iframe
carregamento;
autenticação;
acesso operacional.
webhook
recebimento;
processamento;
sincronização.
Chatwoot
agentes;
equipes;
inboxes;
sincronização.
conversas
cache local;
atualização;
vínculo com lead.
Arquivos críticos
src/app/(app)/atendimento/page.tsx
src/app/api/integrations/chatwoot/credentials/route.ts
src/lib/chatwoot.ts
src/lib/atendimento/orchestration/*
Nunca subir sem validar
acesso ao Atendimento;
webhook operacional;
sincronização básica.
CHECKLIST — PROVIDERS
OBRIGATÓRIO SE MEXER EM PROVIDERS
Validar
provider correto
Evolution continua funcionando;
Cloud API continua funcionando.
inbox correta
1 número = 1 inbox.
webhook
eventos corretos;
provider correto;
organização correta.
lifecycle
conexão;
reconexão;
status;
sincronização.
outbound
envio correto;
provider correto;
inbox correta.
Nunca permitir
mistura de providers;
provider híbrido;
inbox compartilhada;
dispatcher compartilhado.
CHECKLIST — LEADS
OBRIGATÓRIO SE MEXER EM LEADS
Validar
criação
lead cria corretamente;
organizationId correto;
pipeline correto.
edição
update parcial;
update completo;
sem validação indevida.
CSV
importação;
sem nome obrigatório;
persistência correta.
relacionamento
lead ↔ Kanban;
lead ↔ Atendimento;
lead ↔ Tasks;
lead ↔ Agenda.
Bugs atuais obrigatórios de validar
nome obrigatório;
score obrigatório;
lead fora do Kanban;
status desalinhado.
CHECKLIST — KANBAN
OBRIGATÓRIO SE MEXER EM PIPELINE
Validar
sincronização
status ↔ etapa.
movimentação
drag and drop;
persistência;
refresh.
edição
update funcionando;
sem erro de validação.
criação
lead entra corretamente.
Nunca permitir
lead invisível;
etapa divergente;
status divergente.
CHECKLIST — FOLLOW-UP
OBRIGATÓRIO SE MEXER EM FOLLOW-UP
Validar
criação
follow-up cria;
horário salva;
data salva.
relacionamento
task vinculada;
lead vinculado;
agenda vinculada.
drawer
task aparece no lead;
histórico aparece.
Bugs atuais obrigatórios de validar
horário;
vínculo task ↔ lead.
CHECKLIST — TASKS
OBRIGATÓRIO SE MEXER EM TASKS
Validar
filtros
Hoje;
Amanhã;
Atrasadas;
Concluídas.
relacionamento
lead;
usuário;
follow-up.
datas
timezone;
persistência;
ordenação.
Bugs atuais obrigatórios de validar
filtro Hoje;
task não aparece no drawer.
CHECKLIST — AGENDA
OBRIGATÓRIO SE MEXER EM AGENDA
Validar
criação
evento cria;
relacionamento correto.
edição
evento abre;
evento salva;
evento atualiza.
relacionamento
lead;
usuário;
follow-up;
task.
Bugs atuais obrigatórios de validar
“Evento não encontrado”.
CHECKLIST — WEBHOOK
OBRIGATÓRIO SE MEXER EM WEBHOOK
Validar
organização
resolve corretamente.
provider
identifica corretamente.
duplicidade
sem eventos duplicados.
sincronização
lead;
conversa;
notification;
activity.
Nunca permitir
cross-tenant;
loop operacional;
duplicação.
CHECKLIST — AUTH
OBRIGATÓRIO SE MEXER EM AUTH
Validar
login
acesso;
sessão;
tenant correto.
permissões
roles;
acesso correto;
proteção de rotas.
Nunca permitir
login quebrado;
tenant incorreto;
acesso indevido.
CHECKLIST — DATABASE
OBRIGATÓRIO SE MEXER EM PRISMA
Validar
schema
relacionamento;
enums;
índices;
organizationId.
migration
sem perda de dados;
sem quebra operacional.
Nunca permitir
migration destrutiva;
perda de relacionamento;
perda de tenant isolation.
CHECKLIST — UI
OBRIGATÓRIO SE MEXER EM TELAS OPERACIONAIS
Validar
responsividade
desktop;
drawer;
modal;
Kanban.
loading
spinner;
fallback;
erro visual.
fluxo
sem travamento;
sem loop;
sem crash.


-CHECKLIST — DEPLOY

CHECKLIST — CHATWOOT WHITE LABEL

Antes de produção:

- confirmar versão base da produção;
- não usar imagem develop;
- gerar imagem MDS baseada na mesma versão oficial;
- validar build GHCR verde;
- testar primeiro no ambiente teste;
- validar iframe no CRM;
- validar usuário comum;
- validar menus ocultos;
- validar perfil;
- validar envio/recebimento de mensagens;
- validar sidekiq;
- validar rollback documentado.

Produção:

- trocar imagem em chatwoot;
- trocar imagem em sidekiq;
- manter banco, Redis, volumes, labels, domínio e tokens;
- manter MDS_WHITE_LABEL_MODE=true.

Rollback:

- voltar chatwoot e sidekiq para chatwoot/chatwoot:v4.12.1;
- rodar Pull Latest Image & Restart;
- validar app e CRM / Atendimento.

OBRIGATÓRIO ANTES DO DEPLOY
Fluxo oficial
git add
git commit
git push
deploy manual no Coolify
Validar após deploy
obrigatório
login;
Atendimento;
provider;
webhook;
lead;
Kanban;
task;
agenda.
Nunca assumir
deploy automático;
publish automático.
CHECKLIST DE ROLLBACK

Toda alteração crítica deve possuir:

Obrigatório
arquivos alterados;
comportamento anterior;
estratégia de reversão;
commit anterior identificado.
REGRA DOS AGENTES

Todo agente deve:

trabalhar 1 passo por vez;
validar impacto;
validar dependências;
evitar hipótese;
evitar refactor;
preservar estabilidade.
PRIORIDADE OFICIAL DE VALIDAÇÃO
PRIORIDADE MÁXIMA
Atendimento;
providers;
webhook;
Leads;
Pipeline;
multi-tenant.
PRIORIDADE MÉDIA
follow-up;
agenda;
tasks;
multiagente.
PRIORIDADE FUTURA
automações;
analytics;
IA operacional.
STATUS OFICIAL — MAIO 2026
ESTÁVEL
Atendimento base
Webhook
Leads base
Prisma
Multi-tenant
Chatwoot
PARCIAL
Multiagente
Cloud API
Follow-up avançado
Hub de Integrações
CRÍTICO
impedir regressão;
preservar Atendimento;
preservar providers;
corrigir bugs operacionais reais.
SNAPSHOT OFICIAL
Regra principal

Nenhuma alteração sem validação operacional.

Maior risco atual

Regressão causada por alteração sem checklist.

Objetivo atual

Finalizar estabilização operacional do MVP preservando tudo que já está validado.