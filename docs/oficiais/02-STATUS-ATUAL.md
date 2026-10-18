STATUS ATUAL — MDS CRM SaaS
STATUS OFICIAL — MAIO 2026
STATUS GERAL DO PROJETO

O projeto encontra-se em operação real interna na assessoria da Mundo Digital Soluções para validação operacional do MVP comercial.

O sistema já possui:

base operacional estável;
multi-tenant funcional;
integração com Atendimento;
Leads;
Pipeline;
Agenda;
Tasks;
providers WhatsApp;
integrações principais.

O foco atual do projeto é:

estabilização operacional;
correção de bugs reais;
prevenção de regressão;
finalização do MVP comercial.
STATUS OPERACIONAL DO MVP
ESTÁVEL
Atendimento
integração operacional funcionando;
Chatwoot integrado;
webhook operacional;
sincronização básica operacional;
cache local funcionando;
multiinbox funcional.
Leads
CRUD funcional;
integração com Atendimento;
vínculo com conversas;
vínculo com inbox;
segmentação funcional;
tags funcionais.
Pipeline Comercial
Kanban operacional;
estágios funcionais;
movimentação básica funcionando.
Agenda
criação operacional;
integração básica com leads;
recorrência funcional.
Tasks
criação funcional;
recorrência funcional;
integração parcial com follow-ups.
Multi-tenant
isolamento organizacional funcionando;
permissões básicas funcionais.
Prisma + PostgreSQL
estrutura estável;
migrations operacionais;
banco consistente.

STATUS OPERACIONAL DO MVP
Atendimento / Chatwoot White Label

Status: ESTÁVEL EM PRODUÇÃO

Homologado em produção com imagem:

ghcr.io/mundodigitalsolucoes/chatwoot:v4.12.1-mds

Validações concluídas:

- Chatwoot abre em produção;
- iframe no CRM / Atendimento funciona;
- usuário comum acessa conversas;
- menus Captain, Help Center, Campaigns e Settings ocultos;
- logo Chatwoot ocultada;
- menu Configurações do Perfil liberado;
- senha e token de acesso ocultos no perfil;
- tema claro/escuro funcionando;
- rollback testado e preservado.



STATUS PARCIAL
Multiagente

Já existe:

equipes;
membros;
inbox members;
sincronização de agentes.

Ainda em estabilização:

permissões avançadas;
sincronização completa;
comportamento operacional avançado.
WhatsApp Cloud API

Já existe:

outbound dedicado;
dispatcher inicial;
isolamento parcial.

Ainda em evolução:

lifecycle completo;
onboarding completo;
desacoplamento total.
Hub de Integrações

Base existente.

Ainda falta:

consolidação visual;
onboarding unificado;
UX operacional final.

STATUS DOS PROVIDERS
Evolution API

Funcional operacionalmente.

Já suporta:

múltiplas instâncias;
sincronização;
integração com Atendimento.
WhatsApp Cloud API

Estrutura inicial operacional.

Ainda em estabilização.

STATUS DA ARQUITETURA
ESTÁVEL
multi-tenant;
Prisma;
integração Chatwoot;
webhook;
sincronização básica;
Leads;
Pipeline;
Tasks;
Agenda.
PARCIAL
isolamento total de providers;
multiagente avançado;
automações;
follow-up avançado;
Hub de Integrações.
PROBLEMAS OPERACIONAIS EM AUDITORIA

Durante testes reais da assessoria foram encontrados bugs operacionais reais.

BUGS PRIORITÁRIOS — MVP
IMPORTAÇÃO CSV
Problema

Importação CSV inconsistente.

Impacto
falha operacional;
perda de produtividade;
inviabiliza onboarding de listas reais.
NOME OBRIGATÓRIO NO LEAD
Problema

Campo nome obrigatório trava importação real.

Impacto

Muitas listas reais chegam:

apenas com telefone;
apenas com WhatsApp;
apenas com email.

Hoje isso bloqueia operação comercial real.

LEADS NÃO ENTRAM NO KANBAN
Problema

Leads não aparecem corretamente no pipeline após criação/importação.

Impacto

Quebra fluxo comercial.

DESALINHAMENTO ENTRE STATUS E KANBAN
Problema

Status do lead e etapa do Kanban estão desalinhados.

Impacto
inconsistência operacional;
pipeline inconsistente;
filtros incorretos.
ERRO AO EDITAR LEAD PELO KANBAN
Problema

Edição de lead pelo Kanban gera erro de validação.

Impacto

Bloqueia operação comercial.

SCORE OBRIGATÓRIO INDEVIDAMENTE
Problema

Update de lead exige score indevidamente.

Impacto

Validação incorreta no fluxo operacional.

FOLLOW-UP SEM HORÁRIO
Problema

Follow-up criado pelo lead não permite horário.

Impacto

Compromete agenda comercial.

TASK NÃO APARECE NO DRAWER DO LEAD
Problema

Task criada via follow-up não aparece vinculada no drawer do lead.

Impacto

Quebra rastreabilidade comercial.

FILTRO “HOJE” DAS TASKS
Problema

Filtro “Hoje” não retorna corretamente tarefas do dia.

Impacto

Compromete operação diária.

EVENTO DA AGENDA NÃO ENCONTRADO
Problema

Editar evento retorna:

“Evento não encontrado”.
Impacto

Quebra fluxo operacional da agenda.

REGRESSÕES LATERAIS
Problema

Alterações recentes geraram regressões em áreas já funcionais.

Impacto

Maior risco atual do projeto.

RISCO PRIORITÁRIO ATUAL
REGRESSÃO

Hoje o maior risco do projeto é:

alterar área estável;
quebrar integração;
quebrar Atendimento;
quebrar providers;
quebrar sincronização;
quebrar pipeline.
DIRETRIZ OFICIAL ATUAL

A prioridade absoluta agora é:

estabilizar MVP;
corrigir bugs reais;
impedir regressão;
validar operação comercial;
consolidar providers;
estabilizar Atendimento;
estabilizar Vendas.
ÁREAS CRÍTICAS PROTEGIDAS

Arquivos protegidos:

src/app/(app)/atendimento/page.tsx
src/app/api/integrations/chatwoot/credentials/route.ts

Mudanças:

somente com rollback;
somente com validação;
somente com impacto mapeado.
STATUS DO DEPLOY
OFICIAL

Fluxo atual:

desenvolvimento local;
git add;
git commit;
git push;
deploy manual no Coolify.

Deploy NÃO é automático.

PRIORIDADE ATUAL DO MVP
PRIORIDADE MÁXIMA
estabilidade;
Atendimento;
Leads;
Pipeline;
follow-up;
providers;
prevenção de regressão.
PRIORIDADE MÉDIA
automações;
relatórios;
analytics;
UX avançada.
PRIORIDADE FUTURA
IA operacional;
campanhas automatizadas;
analytics avançado;
automações inteligentes.
STATUS FINAL — MAIO 2026
FUNCIONANDO
Atendimento base
Leads
Pipeline base
Agenda base
Tasks base
Multi-tenant
Prisma
Chatwoot
Webhook
Integrações principais
EM ESTABILIZAÇÃO
Multiagente
Cloud API
Follow-up avançado
Hub de Integrações
Isolamento total de providers
CRÍTICO
impedir regressão;
corrigir bugs operacionais;
preservar Atendimento;
preservar integrações;
preservar providers;
preservar pipeline comercial.
SNAPSHOT OFICIAL
Cenário atual

Sistema já opera em ambiente real interno.

Objetivo imediato

Finalizar estabilização operacional do MVP comercial.

Maior prioridade

Eliminar regressões.

Diretriz oficial

Nenhuma evolução pode quebrar o que já está validado.