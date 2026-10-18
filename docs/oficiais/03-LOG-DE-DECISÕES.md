LOG DE DECISÕES — MDS CRM SaaS
REGISTRO OFICIAL DE DECISÕES TÉCNICAS E ESTRATÉGICAS
STATUS OFICIAL — MAIO 2026
OBJETIVO DO DOCUMENTO

Este documento registra:

decisões estruturais;
decisões operacionais;
mudanças arquiteturais;
diretrizes oficiais;
regras permanentes do projeto.

Objetivo principal:

evitar regressão;
evitar looping técnico;
evitar perda de contexto;
impedir reversão indevida de decisões já validadas.
REGRA MÃE OFICIAL
É PROIBIDO GERAR REGRESSÃO
Decisão Oficial

Nenhuma evolução pode quebrar funcionalidades já validadas.

Motivo

O projeto entrou em looping operacional:

correções quebravam áreas estáveis;
agentes refatoravam sem necessidade;
alterações geravam regressões laterais.
Diretriz Permanente

Toda alteração deve:

preservar estabilidade;
preservar integrações;
preservar providers;
preservar Atendimento;
possuir rollback.
ATENDIMENTO COMO BACKEND OFICIAL
Decisão Oficial

O Atendimento é o backend operacional oficial do sistema.

O CRM NÃO:
substitui o Atendimento;
recria operação de mensagens;
recria lógica operacional nativa.
O CRM:
orquestra;
sincroniza;
integra;
controla contexto comercial;
conecta Leads e Vendas.
Motivo

Evitar duplicação operacional e complexidade desnecessária.

NOME OFICIAL “ATENDIMENTO” - Nunca usa o nome Chatwoot no CRM - O user nem deve saber que existe Chatwoot
Decisão Oficial

No produto e na documentação deve-se usar:

“Atendimento”

Evitar:

nomes técnicos internos;
referências estruturais desnecessárias.
Motivo

Padronização operacional e comercial.

REGRA OFICIAL DOS PROVIDERS
Decisão Oficial
1 número
1 inbox

1 canal operacional

Motivo

Evitar:

mistura operacional;
perda de contexto;
conflitos de lifecycle;
conflito de webhook;
inconsistência de mensagens.
ISOLAMENTO DE PROVIDERS
Decisão Oficial

Providers NÃO podem compartilhar:

inbox;
webhook;
sessão;
autenticação;
lifecycle;
reconexão;
fila operacional.
Providers oficiais
Evolution API
WhatsApp Cloud API
Motivo

Evitar acoplamento destrutivo.

WHATSAPP CLOUD API SEPARADA
Decisão Oficial

Cloud API deve possuir:

dispatcher próprio;
outbound próprio;
lifecycle próprio;
onboarding próprio.
Motivo

Evitar dependência da arquitetura Evolution.

MULTIAGENTE COMO PRIORIDADE
Decisão Oficial

Atendimento multiagente faz parte do núcleo comercial do MVP.

Estruturas obrigatórias
equipes;
membros;
inbox members;
sincronização CRM ↔ Atendimento.
Motivo

Esse é um diferencial operacional do produto.

CHATWOOT WHITE LABEL COMO FORK CONTROLADO

Decisão Oficial

O Atendimento utiliza Chatwoot como backend operacional, com camada white label MDS aplicada em fork próprio.

A imagem oficial homologada para produção é:

ghcr.io/mundodigitalsolucoes/chatwoot:v4.12.1-mds

Regra permanente:

É proibido usar imagem baseada em develop diretamente em produção.

Toda customização do Chatwoot deve ser baseada na mesma versão da produção.

Exemplo:

Produção oficial:
chatwoot/chatwoot:v4.12.1

Imagem MDS correspondente:
ghcr.io/mundodigitalsolucoes/chatwoot:v4.12.1-mds

Motivo

Evitar incompatibilidade de banco, migrations, assets, dependências e runtime.

Rollback oficial:

Voltar chatwoot e sidekiq para:

chatwoot/chatwoot:v4.12.1


LEADS INTEGRADOS AO ATENDIMENTO
Decisão Oficial

Lead deve possuir vínculo operacional com Atendimento.

Integrações oficiais
chatwootContactId
chatwootConversationId
chatwootInboxId
Motivo

Unificar comercial e atendimento.

CACHE LOCAL DE CONVERSAS
Decisão Oficial

Conversa do Atendimento deve possuir cache local operacional.

Estrutura oficial
ChatwootConversation
Objetivos
acelerar interface;
reduzir consultas externas;
integrar Leads;
gerar contexto operacional.
WEBHOOK CENTRALIZADO
Decisão Oficial

Webhook oficial do Atendimento:

/api/webhooks/chatwoot

Fluxo oficial

Chatwoot
→ webhook CRM
→ resolve organização
→ sincroniza CRM

Motivo

Centralizar integração operacional.

CORE PROTEGIDO
Decisão Oficial

Arquivos críticos:

src/app/(app)/atendimento/page.tsx
src/app/api/integrations/chatwoot/credentials/route.ts
Regra

Mudanças:

somente com impacto mapeado;
somente com rollback;
somente com validação operacional.
Motivo

Esses arquivos impactam o núcleo operacional do sistema.

PROIBIÇÃO DE REFATORAÇÃO DESNECESSÁRIA
Decisão Oficial

É proibido:

refatorar por estética;
reorganizar sem necessidade;
alterar arquitetura estável por hipótese.
Motivo

Grande parte das regressões vieram de refactors desnecessários.

DESENVOLVIMENTO GUIADO PELO MVP
Decisão Oficial

O projeto deve priorizar:

estabilidade;
Atendimento;
Vendas;
providers;
correção de bugs reais.
Não priorizar agora
micro otimizações;
features cosméticas;
refactors estruturais;
IA avançada;
automações complexas.
TESTE REAL OPERACIONAL
Decisão Oficial

O CRM será validado primeiro dentro da operação real da assessoria.

Motivo

Encontrar:

bugs reais;
gargalos reais;
problemas operacionais;
inconsistências de fluxo.
BUGS REAIS COMO PRIORIDADE
Decisão Oficial

Problemas encontrados em operação real possuem prioridade máxima.

Problemas atuais prioritários
CSV inconsistente;
Kanban desalinhado;
follow-up sem horário;
task sem vínculo;
filtro “Hoje” inconsistente;
agenda quebrando edição;
regressões laterais.
Motivo

Esses problemas impactam diretamente operação comercial real.

PIPELINE COMERCIAL COMO NÚCLEO
Decisão Oficial

O pipeline comercial faz parte do núcleo do MVP.

Estruturas obrigatórias
Lead
Pipeline
Follow-up
Agenda
Tasks
Activities
Motivo

O CRM é comercialmente orientado.

MULTI-TENANT OBRIGATÓRIO
Decisão Oficial

Toda entidade operacional deve possuir:

organizationId
Motivo

Garantir:

isolamento;
segurança;
SaaS real.
GIT E DEPLOY
Decisão Oficial

git push NÃO publica.

Fluxo oficial
git add
git commit
git push
deploy manual no Coolify
Motivo

Evitar publicação acidental em produção.

COOLIFY COMO ORQUESTRADOR
Decisão Oficial

Deploy oficial via Coolify.

Motivo

Centralizar:

containers;
deploy;
ambiente;
rollback operacional.
DOCUMENTAÇÃO COMO FONTE OFICIAL
Decisão Oficial

DECISÃO OFICIAL — MAIO/2026

Deploy oficial via Dockerfile homologado.

Builder:
- npm ci
- prisma generate
- next build

Runner:
- não executar npm ci
- não executar prisma generate

Motivo:

Evitar falha de build causada por execução de postinstall/prisma generate
sem schema disponível no Runner.

Status:

Homologado em produção.

Ordem oficial de autoridade documental:

Documento Mestre Oficial
STATUS-ATUAL
LOG-DE-DECISOES
ARQUITETURA-OFICIAL
REGRAS-DE-IMPLEMENTAÇÃO
BACKLOG-PRIORIZADO
Motivo

Evitar conflito de contexto.

DIRETRIZ OPERACIONAL DOS AGENTES
Decisão Oficial

Todo agente deve:

trabalhar 1 passo por vez;
evitar hipótese;
evitar refactor desnecessário;
validar impacto antes de alterar;
respeitar core protegido;
respeitar providers;
respeitar arquitetura oficial.
DIRETRIZ DE EVOLUÇÃO FUTURA
Decisão Oficial

Toda evolução futura deve priorizar:

estabilidade;
desacoplamento seguro;
prevenção de regressão;
providers;
Atendimento;
Vendas.
ARQUITETURA-ALVO FUTURA
Decisão Oficial

Objetivos futuros:

providers totalmente isolados;
onboarding unificado;
automações comerciais;
analytics operacional;
IA operacional;
Hub de Integrações consolidado.
Observação

Somente após estabilização do MVP.

STATUS OFICIAL — MAIO 2026
ESTÁVEL
Atendimento base
Webhook
Leads
Pipeline base
Prisma
Multi-tenant
Chatwoot
PARCIAL
Multiagente
Cloud API
Isolamento total de providers
Follow-up avançado
Hub de Integrações
CRÍTICO
impedir regressão;
estabilizar MVP;
corrigir bugs operacionais;
preservar Atendimento;
preservar providers.
SNAPSHOT OFICIAL
Cenário atual

Projeto em estabilização operacional do MVP.