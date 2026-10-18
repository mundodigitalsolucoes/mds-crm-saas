CORE PROTEGIDO — MDS CRM SaaS
ÁREAS CRÍTICAS PROTEGIDAS DO SISTEMA
STATUS OFICIAL — MAIO 2026
OBJETIVO DO DOCUMENTO

Este documento define:

arquivos críticos;
fluxos críticos;
áreas sensíveis;
regras obrigatórias de alteração;
procedimentos de segurança operacional.

Objetivo principal:

impedir regressão;
proteger Atendimento;
proteger providers;
proteger integrações;
impedir quebra do MVP.
REGRA MÃE
O CORE NÃO PODE QUEBRAR

Nenhuma alteração pode:

derrubar Atendimento;
quebrar providers;
quebrar webhook;
quebrar sincronização;
quebrar pipeline;
quebrar multi-tenant;
quebrar integrações homologadas.
REGRA OFICIAL DO CORE

Alterações no core:

somente com necessidade real;
somente com impacto mapeado;
somente com rollback;
somente com validação operacional;
somente 1 alteração por vez.
ARQUIVOS CRÍTICOS — NÍVEL MÁXIMO
1. ATENDIMENTO IFRAME
Arquivo

src/app/(app)/atendimento/page.tsx

Criticidade

MÁXIMA

Responsabilidade
carregamento operacional do Atendimento;
autenticação operacional;
integração iframe;
experiência principal de atendimento.
Risco

Qualquer quebra:

derruba operação;
derruba atendimento comercial;
quebra experiência principal do MVP.
Regras

Nunca:

refatorar sem necessidade;
alterar sem rollback;
alterar comportamento visual sem validação;
alterar fluxo operacional por hipótese.
2. CREDENCIAIS CHATWOOT
Arquivo

src/app/api/integrations/chatwoot/credentials/route.ts

Criticidade

MÁXIMA

Responsabilidade
autenticação;
integração Chatwoot;
credenciais operacionais;
acesso ao Atendimento.
Risco

Qualquer quebra:

derruba integração;
derruba Atendimento;
quebra sincronização;
quebra onboarding operacional.
Regras

Nunca:

alterar estrutura sem validar;
alterar payload sem impacto mapeado;
alterar autenticação sem rollback.
ÁREAS CRÍTICAS — NÍVEL ALTO
WEBHOOK OPERACIONAL
Arquivo crítico

src/app/api/webhooks/chatwoot/route.ts

Responsabilidade
entrada oficial dos eventos;
sincronização CRM ↔ Atendimento;
processamento operacional.
Risco

Quebra:

sincronização;
Leads;
pipeline;
notificações;
atividades.
Regras

Nunca:

alterar eventos sem validação;
alterar organization resolve sem validar multi-tenant;
alterar fluxo assíncrono sem teste real.
LEAD BRIDGE
Arquivo crítico

src/lib/atendimento/orchestration/lead-bridge.ts

Responsabilidade
integração Atendimento ↔ Leads;
criação automática de lead;
sincronização operacional;
vínculo de conversa;
vínculo de inbox.
Risco

Quebra:

pipeline;
Leads;
sincronização;
contexto comercial.
Regras

Nunca:

alterar relacionamento sem validar;
alterar sync sem teste real;
alterar idempotência sem análise.
CHATWOOT EVENTS
Arquivo crítico

src/lib/atendimento/orchestration/chatwoot-events.ts

Responsabilidade
dispatcher operacional;
processamento de eventos;
providers;
lifecycle operacional.
Risco

Quebra:

providers;
Atendimento;
sincronização;
lifecycle operacional.
Regras

Nunca:

misturar providers;
alterar dispatcher sem validar;
alterar lifecycle sem rollback.
CHATWOOT WEBHOOKS
Arquivo crítico

src/lib/atendimento/orchestration/chatwoot-webhooks.ts

Responsabilidade
sincronização operacional;
tratamento de eventos;
persistência operacional.
Risco

Quebra:

sincronização;
cache local;
pipeline operacional.
CHATWOOT LIB
Arquivo crítico

src/lib/chatwoot.ts

Responsabilidade
API helper oficial;
autenticação;
inboxes;
agentes;
equipes;
platform API.
Risco

Quebra:

integração completa;
onboarding;
multiagente;
sincronização.
Regras

Nunca:

alterar autenticação sem validação;
alterar helper global sem impacto mapeado.
PROVIDERS — ÁREA CRÍTICA
Evolution API
Criticidade

ALTA

Risco

Mistura operacional e regressão.

Regras

Nunca:

compartilhar lifecycle;
compartilhar sessão;
compartilhar inbox com outro provider.
WhatsApp Cloud API
Criticidade

ALTA

Risco

Acoplamento indevido com Evolution.

Regras

Cloud API deve possuir:

outbound próprio;
dispatcher próprio;
onboarding próprio;
lifecycle próprio.
MULTI-TENANT — ÁREA CRÍTICA
Criticidade

MÁXIMA

Regra obrigatória

Toda query deve respeitar:

organizationId;
isolamento organizacional;
contexto do tenant.
Risco

Quebra de segurança SaaS.

PIPELINE COMERCIAL — ÁREA CRÍTICA
Criticidade

ALTA

Estruturas críticas
Lead
Pipeline
Stage
Activities
Tasks
Follow-up
Risco
perda operacional;
inconsistência comercial;
Kanban quebrado.
TASKS — ÁREA CRÍTICA
Criticidade

ALTA

Regra

Task vinculada deve:

aparecer no lead;
respeitar relacionamento;
respeitar datas;
respeitar organização.
AGENDA — ÁREA CRÍTICA
Criticidade

ALTA

Regra

Evento:

não pode perder referência;
não pode perder relacionamento;
não pode quebrar edição.
REGRA OFICIAL DE ALTERAÇÃO
OBRIGATÓRIO ANTES DE ALTERAR
localizar fluxo real;
validar impacto;
validar dependências;
definir rollback;
alterar mínimo possível;
validar operacionalmente.
ALTERAÇÕES PROIBIDAS
Nunca fazer
refatoração ampla;
reorganização estrutural;
troca de arquitetura;
alteração simultânea de múltiplos fluxos;
alteração sem rollback;
alteração sem validação.
VALIDAÇÃO OBRIGATÓRIA

Toda alteração crítica deve validar:

Obrigatório
build;
TypeScript;
Prisma;
Atendimento;
provider;
webhook;
Lead;
Pipeline;
multi-tenant;
fluxo operacional afetado.
REGRA DOS AGENTES

Todo agente deve:

trabalhar 1 passo por vez;
evitar hipótese;
evitar refactor;
preservar estabilidade;
preservar integrações;
respeitar providers;
respeitar arquitetura oficial.
PRIORIDADE OFICIAL DO CORE
PRIORIDADE MÁXIMA
Atendimento;
webhook;
providers;
multi-tenant;
Leads;
Pipeline.
PRIORIDADE MÉDIA
multiagente;
automações;
follow-up avançado.
PRIORIDADE FUTURA
IA operacional;
analytics avançado;
automações inteligentes.
STATUS OFICIAL — MAIO 2026
ESTÁVEL
Atendimento base
Webhook
Chatwoot
Prisma
Leads base
Pipeline base
PARCIAL
Multiagente
Cloud API
Isolamento total de providers
Follow-up avançado
CRÍTICO
impedir regressão;
preservar Atendimento;
preservar providers;
preservar sincronização operacional.
SNAPSHOT OFICIAL
Maior risco atual

Regressão causada por alteração sem contexto.

Regra principal

O core do sistema NÃO pode quebrar.

Objetivo atual

Finalizar estabilização operacional do MVP comercial preservando toda área já validada.