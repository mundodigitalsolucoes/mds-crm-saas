REGRA DE ISOLAMENTO DE PROVIDERS — MDS CRM SaaS
REGRA OFICIAL DE ISOLAMENTO OPERACIONAL
STATUS OFICIAL — MAIO 2026
OBJETIVO DO DOCUMENTO

Este documento define as regras obrigatórias de isolamento entre providers do sistema.

Objetivos:

impedir mistura operacional;
impedir regressão;
impedir conflito de lifecycle;
impedir inconsistência de mensagens;
preservar estabilidade do Atendimento;
garantir escalabilidade futura.
REGRA MÃE
PROVIDERS NÃO PODEM SE MISTURAR

Cada provider deve possuir:

fluxo próprio;
lifecycle próprio;
sessão própria;
webhook próprio;
autenticação própria;
dispatcher próprio;
onboarding próprio.
REGRA OFICIAL DOS CANAIS
REGRA FIXA
1 número
1 inbox

1 canal operacional

Nunca:

compartilhar inbox;
compartilhar sessão;
compartilhar lifecycle;
compartilhar autenticação;
compartilhar webhook.
PROVIDERS OFICIAIS
Provider 1

WhatsApp Business via Evolution API

Provider 2

WhatsApp API Oficial via Meta Cloud API

REGRA DE ISOLAMENTO

Providers NÃO podem compartilhar:

inbox;
webhook;
dispatcher;
sessão;
autenticação;
lifecycle;
reconexão;
fila operacional;
status operacional;
onboarding;
handlers;
sincronização interna.
EVOLUTION API
RESPONSABILIDADE

Provider operacional baseado em:

instâncias;
QRCode;
sessão persistente;
conexão WhatsApp Web.
CARACTERÍSTICAS

Possui:

reconexão própria;
lifecycle próprio;
autenticação própria;
eventos próprios;
status próprios.
REGRAS

Nunca:

reutilizar lógica da Cloud API;
compartilhar dispatcher;
compartilhar onboarding;
compartilhar sessão.
WHATSAPP CLOUD API
RESPONSABILIDADE

Provider oficial Meta baseado em:

API oficial;
token;
webhook Meta;
autenticação oficial.
CARACTERÍSTICAS

Possui:

lifecycle próprio;
autenticação própria;
webhook próprio;
status próprios;
onboarding próprio.
REGRAS

Cloud API deve possuir:

outbound próprio;
inbound próprio;
dispatcher próprio;
onboarding próprio;
lifecycle próprio.

Nunca:

acoplar na Evolution;
reutilizar handlers incompatíveis;
compartilhar sessão;
compartilhar reconexão.
REGRA DO DISPATCHER
CADA PROVIDER DEVE POSSUIR DISPATCHER PRÓPRIO

Dispatcher deve:

identificar provider;
processar somente fluxo compatível;
evitar cross-provider;
evitar eventos indevidos.
REGRA DE WEBHOOK
WEBHOOKS NÃO PODEM SE MISTURAR

Cada provider deve possuir:

identificação própria;
validação própria;
autenticação própria;
fluxo próprio.
REGRA DE SESSÃO
SESSÕES NÃO PODEM SER COMPARTILHADAS

Nunca:

reutilizar sessão;
compartilhar reconnect;
compartilhar auth;
compartilhar lifecycle.
REGRA DE STATUS OPERACIONAL

Cada provider deve possuir:

status independente;
persistência independente;
sincronização independente.
REGRA DE ONBOARDING

Cada provider deve possuir:

onboarding próprio;
setup próprio;
validação própria;
autenticação própria.
REGRA DE PERSISTÊNCIA

Provider deve persistir:

status;
sessão;
autenticação;
lifecycle;
dados operacionais.

Sem depender do outro provider.

REGRA DE IDENTIFICAÇÃO

Provider deve ser identificável operacionalmente.

REGRA ATUAL

Hoje o sistema utiliza:

metadata.provider
DIRETRIZ FUTURA

Provider deverá possuir:

coluna oficial própria;
isolamento estrutural completo.
REGRA DE EVENTOS

Eventos devem:

validar provider;
validar organização;
validar inbox;
validar canal operacional.

Nunca:

processar evento cruzado;
misturar handlers;
misturar lifecycle.
REGRA DE MULTI-TENANT

Toda operação deve respeitar:

organizationId;
isolamento do tenant;
contexto organizacional.
REGRA DO ATENDIMENTO

O Atendimento é o backend operacional oficial.

O CRM:

NÃO recria lógica operacional;
NÃO mistura providers operacionalmente;
apenas integra e sincroniza.
REGRA DO KANBAN E LEADS

Providers nunca podem:

duplicar lead;
criar inconsistência;
quebrar relacionamento;
quebrar sincronização.
REGRA DE IMPLEMENTAÇÃO

Toda alteração em provider exige:

impacto mapeado;
rollback;
validação operacional;
teste real;
validação multi-tenant.
ALTERAÇÕES PROIBIDAS
Nunca fazer
refatoração ampla;
unificação artificial;
provider híbrido;
compartilhamento de lifecycle;
compartilhamento de sessão;
compartilhamento de reconnect;
compartilhamento de dispatcher.
RISCOS OPERACIONAIS
MAIOR RISCO ATUAL

Mistura operacional entre providers.

CONSEQUÊNCIAS
mensagens inconsistentes;
reconnect quebrado;
inbox incorreta;
perda operacional;
duplicidade;
regressão.
STATUS ATUAL — MAIO 2026
EVOLUTION API

FUNCIONAL

Já possui:

instâncias;
conexão;
sincronização;
integração operacional.
CLOUD API

PARCIAL

Já possui:

outbound dedicado;
dispatcher inicial;
isolamento parcial.

Ainda falta:

onboarding completo;
inbound consolidado;
lifecycle completo;
desacoplamento total.
DIRETRIZ OFICIAL DE EVOLUÇÃO

A evolução futura deve priorizar:

desacoplamento seguro;
isolamento estrutural;
prevenção de regressão;
estabilidade operacional;
compatibilidade com Atendimento.
PRIORIDADE OFICIAL
PRIORIDADE MÁXIMA
estabilidade;
isolamento;
providers;
prevenção de regressão.
PRIORIDADE MÉDIA
onboarding;
Hub de Integrações;
UX operacional.
PRIORIDADE FUTURA
automações;
analytics;
IA operacional.
STATUS FINAL — MAIO 2026
ESTÁVEL
Evolution API operacional
integração Atendimento
sincronização base
webhook base
PARCIAL
Cloud API
isolamento estrutural total
onboarding consolidado
CRÍTICO
impedir mistura operacional;
impedir regressão;
preservar Atendimento;
preservar lifecycle operacional.
SNAPSHOT OFICIAL
Regra principal

Providers NÃO podem se misturar.

Objetivo atual

Consolidar isolamento operacional seguro.

Maior risco atual

Acoplamento indevido entre providers.