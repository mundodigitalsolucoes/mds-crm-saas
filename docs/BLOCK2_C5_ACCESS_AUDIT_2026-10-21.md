# C5 — Auditoria de URLs/APIs por contrato — 2026-10-21

Referência inicial confirmada: `audit/block2-sanitized`, HEAD `5f0f8a9905be91aa1e68ccd00e9602c346e6a5ee`, árvore limpa. **Resultado original: rollout bloqueado; aceite de segurança reprovado.** C5 executa auditoria, testes e documentação; não altera handlers, motor comercial, providers ou o core. `observe_only` permanece efetivo e `APPROVED_ENFORCEMENTS` permanece vazio. C6 não iniciado.

> **Atualização C5 SECURITY:** os casos C5-01 (P0 nesta autorização) e C5-02 (P1) foram corrigidos no commit `a9aa6ed`; probes originais: **42/42 expectativas seguras, zero notificações estrangeiras e zero exposição de Leads nos 84 cenários**. [Correção, matriz atualizada, comandos e riscos](BLOCK2_C5_SECURITY_FIX_2026-10-21.md). [Evidência comparativa](evidence/BLOCK2_C5_SECURITY_RESULTS_2026-10-21.json). A seção abaixo preserva a auditoria anterior à correção. C5-03/C5-04 e rollout continuam pendentes; G1–G6 não aprovados. Observe_only e manifesto vazio intactos; C6 não iniciado.

## Como interpretar a matriz

- **S**: inspeção de código por operação; não é certificação funcional de cada fluxo. `checkPermission/checkModulePermission` reutilizam validação de identidade ativa e permissões do banco; o helper foi exercitado funcionalmente, mas sua presença não prova todo o data-flow do handler.
- **H**: HTTP real no build local, NextAuth e PostgreSQL descartável. Foram 84 cenários: sete conjuntos de módulos × MDS/White-Label × três papéis × dois tenants; 924 GETs de páginas e 840 operações de leitura listadas individualmente, além de Dashboard, controles e negativos. Um 200 de shell client não equivale a dados autorizados ou bloqueio comercial.
- **I**: teste isolado do motor/guard/layout real, com modo injetado somente no VM de teste. Nenhum switch novo foi adicionado ao runtime. O modo HTTP real sempre foi observe_only.
- **F**: falha de segurança comprovada por HTTP. Probes retornam **1**, sem TODO/skip. As suítes usuais passando não apagam essas falhas.
- O inventário AST contém 116 arquivos de API, 177 operações e 28 páginas. 35 operações usam guard de módulo, 22 observam canais e 120 não têm integração comercial direta detectada ou delegam o controle. Esses 120 incluem administração, autenticação, plataforma e callbacks: **não são 120 vulnerabilidades nem 120 rotas a bloquear automaticamente**.
- Callbacks/webhooks exigem autenticação do provider, assinatura/token/state/nonce e escopo do recurso; não devem receber sessão tenant artificial. Auditoria estática de helpers e os testes existentes não substituem homologação real dos providers.

## Bloqueadores confirmados e ações necessárias

### C5-01 — P1: vínculos entre organizações em Tarefas e OS

`POST /api/tasks`, `PUT /api/tasks/[id]`, `POST /api/os` e `PUT /api/os/[id]` aceitaram UUIDs de recursos do tenant B numa entidade do tenant A. Tarefas: leadId/projectId/assignedToId; OS: projectId/assignedToId. Com owner/admin/user autorizados no recurso principal, **30 gravações** retornaram 201/200, persistiram o vínculo estrangeiro e devolveram nome/título relacionado. Inclui **nove notificações criadas para responsável estrangeiro**, em fixture local.

`GET /api/tasks`, `GET /api/tasks/[id]`, `GET /api/os` e `GET /api/os/[id]` também retornaram relações estrangeiras em **12 leituras**. O probe inclui vínculos históricos malformados criados diretamente na fixture: corrigir apenas as gravações não resolve o legado. Todas as 42 expectativas seguras falharam. Os filtros organizationId protegem a raiz da entidade, não seus joins automaticamente.

**Correção necessária antes de rollout:** validar cada referência não nula no mesmo tenant, exigir usuário ativo, preservar semântica de campo omitido/null, vincular o seletor final da escrita ao tenant e tratar leitura de relações históricas inválidas. Fazer isso antes de criar notificações/atividades. Usar os filtros/helpers existentes onde apropriado; não criar motor comercial. Escopo mínimo proposto: `src/app/api/tasks/{route.ts,[id]/route.ts}` e `src/app/api/os/{route.ts,[id]/route.ts}`, com helper existente de relações ou adaptação fina e testes negativos. Revisar também superfícies relacionadas, sem afirmar por analogia que todas falham. Nenhum saneamento de dados reais ou migration foi executado.

### C5-02 — P1: permissão de Leads contornada pela leitura de Tarefas

Em **28 cenários** de usuário comum, `/api/leads` respondeu 403, mas `GET /api/tasks` respondeu 200 com o nome do Lead vinculado da própria organização. O Dashboard C0 continua protegido, sem esse dado. Trata-se de vazamento por recurso relacionado, não de simples acesso comercial permitido em observe_only.

**Correção necessária:** aplicar a autorização dos dados relacionados no servidor, preservando operações legítimas de Tarefas, como C0 já faz no Dashboard. Definir explicitamente se deve excluir a tarefa vinculada ou ocultar a relação, sem transformar tasks.view em autorização irrestrita para dados de Leads/Projetos. Cobrir também campos derivados e payload completo HTTP. Não foi introduzida uma permissão artificial nem alterada a API nesta auditoria.

### C5-03 — Bloqueador de rollout: cobertura comercial parcial

O guard de módulo cobre 16 operações de Vendas (incluindo importação), cinco de Projetos/Marketing e 14 de Atendimento. Há 22 operações com observação de canal que **nunca bloqueia**, além de rotas de providers que usam apenas integrations e verificações operacionais. Mudar o manifesto sozinho não cobrirá todo o produto.

O motor aceita somente pares já auditados: marketing/projects, vendas/leads, vendas/kanban e atendimento/atendimento. Tasks, OS, Agenda, Metas, relatórios, tags, comentários e anexos precisam de política por recurso/contexto e integração delimitada. O agrupamento de apresentação C2 não cria automaticamente essa política. As APIs integrations de Atendimento devem preservar sua permissão operacional existente; não substituí-la por uma permissão mais fraca. Callbacks e lifecycle precisam de política separada, sem novos bloqueios cegos.

**Antes de promover um tenant:** completar a cobertura e os testes por método, inclusive operações sensíveis e canais; validar os contratos compartilhados e a decisão de suspensão/continuidade dos callbacks. Os 17 entry points exercitados em isolamento bloqueiam antes de dados/provider, mas não representam os 177 métodos ou todos os efeitos remotos.

### C5-04 — Compatibilidade: permissões parciais e identificadores legados

Um registro válido para o helper atual contendo somente atendimento.view/create/edit/delete permite a operação em observe_only; o motor futuro retorna insufficient_permission porque `validPermissions` exige a chave leads. **É bloqueio de usuário legítimo na promoção**, não uma proteção comercial adicional comprovada. Revisar esse validador existente e os formatos reais antes de ativar enforcement, sem tornar JSON corrompido permissivo.

Organization.features vazio, inválido, só White-Label ou só módulo planejado não herda módulos por Plan.features, papel ou nome enterprise. Um trial vencido pode continuar com leitura legada em observe_only e ser negado pelo motor futuro como inactive_subscription; quotas/regras de escrita continuam próprias dos handlers. Isso exige inventário/decisão, não sync automático. Identificadores opacos podem ser retidos pelo resolver de módulos, enquanto o avaliador de canal rejeita qualquer identificador desconhecido como invalid_features. Homologar essa compatibilidade antes de promover canais.

O diagnóstico local READ ONLY encontrou **zero organizações** fora das fixtures já removidas. O diagnóstico legado é de fixtures; não certifica cadastros/plans de produção ou de clientes MDS reais. Nenhuma produção foi consultada.

### C5-05 — Páginas e dados compartilhados

`checkModulePage` em observe_only observa negativas e só redireciona a ausência de autenticação. URLs diretas retornam shell 200; permissões são aplicadas pelo cliente e, para dados, pelas APIs. O layout autenticado valida identidade ativa; Dashboard valida e filtra seus próprios dados no servidor. Não apresentar o shell 200 como prova de bloqueio ou de vazamento por si só.

`/reports`, agrupado em Marketing na UI, usa `useLeadsStore/fetchLeads` e verifica reports.view (`src/app/(app)/reports/page.tsx`, linhas 139–143 e 275). É uma dependência estática de dados Vendas, não prova de que Marketing deve conceder Leads. Definir a composição de relatórios por recurso antes do rollout para não quebrar a independência dos módulos. Tarefas/follow-ups compartilham uma API e podem ter vínculos com Lead/Projeto; um wildcard de URL não resolve esse contrato.

## Evidência de execução

Ver `docs/evidence/BLOCK2_C5_RESULTS_2026-10-21.json` para resultados, saídas HTTP, hashes e vínculos de proveniência. Artefatos completos em `/workspace/mds-crm-onboarding-evidence/c5/`.

| Execução | Resultado |
|---|---|
| `node tests/c5-direct-access-http.mjs` | **Exit 1**: 84 cenários executados; baseline observe_only esperado, 924 páginas/840 leituras; 28 falhas de permissão relacionada C5-02. Inclui oito negativos anônimos, dois IDs estrangeiros por cenário e três configurações legadas |
| `node tests/c5-cross-tenant-http.mjs` | **Exit 1**: 42 falhas seguras, 30 gravações e 12 leituras, C5-01; não é TODO nem aceite parcial |
| `node --import tsx --test tests/c5-commercial-guards-postgres.test.mjs` | Cinco testes PASS; 1.344 combinações de request, cada qual avaliada em observe/enforce; 17 operações de handlers reais bloqueadas em isolamento sem acesso a recursos/provider; estados de identidade/permissão/tenant e compatibilidade |
| `npx tsx --test tests/c5-commercial-pages.test.ts` | 15 PASS; 14 combinações módulo/marca × cinco layouts × dois modos isolados, mais divergência de política de identificadores legados |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs` | 110 PASS, zero fail/skip/TODO; **não inclui os probes HTTP standalone e não significa aceite de C5** |
| `npx tsx --test tests/*.test.ts` | 383 PASS, zero fail/skip/TODO |
| Regressões HTTP C0 e C3/C4, smoke existente | C0 preservado; 84 cenários White-Label e 29 mudanças comerciais auditadas; 22 cenários gerais PASS |
| `npm run build`, `npx tsc --noEmit`, lint dos arquivos adicionados | PASS; lint zero erros/avisos nos cinco arquivos adicionados. Sem migration nem regra de lint alterada |

Os probes HTTP exigem servidor local compilado em loopback:3100 e PostgreSQL descartável em loopback/mds_crm_dev; geram credenciais somente em memória, sem logs de valores e sem serviços externos. IPs reservados distintos isolam o rate limiter das fixtures. O teste de enforcement usa o código existente com dependências isoladas no VM e banco descartável real; não modifica policy.ts nem disponibiliza flags de promoção ao cliente. O flag mode=enforce enviado por query em HTTP real não muda o modo.

## Classificação por operação

A matriz abaixo é fonte/inspeção (S). Resultados HTTP e falhas são apontados onde há comprovação; os demais métodos precisam de validação funcional específica. `tenantSignal` do JSON significa ocorrência na chamada, não análise de fluxo ou garantia de isolamento. Administração, plataforma e protocolos públicos são inventariados para evitar lacunas, mas não ganham dono comercial por inferência.

### Vendas — 16 operações

| URL | Método | Autenticação | Permissão operacional | Isolamento | Contrato | Bloqueio comercial |
|---|---|---|---|---|---|---|
| `/api/import` | POST | S: identidade ativa via helper | S: leads.create | S: 1 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/kanban/stages/[key]` | PUT | S: identidade ativa via helper | S: kanban.edit | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/kanban/stages/[key]` | DELETE | S: identidade ativa via helper | S: kanban.delete | S: 3 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/kanban/stages` | GET | S: identidade ativa via helper | S: kanban.view | S + H: raiz; não certifica todos os vínculos | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/kanban/stages` | POST | S: identidade ativa via helper | S: kanban.create | S + H: raiz; não certifica todos os vínculos | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/[id]` | GET | S: identidade ativa via helper | S: leads.view | S + H: ID estrangeiro negado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/[id]` | PUT | S: identidade ativa via helper | S: leads.edit | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/[id]` | DELETE | S: identidade ativa via helper | S: leads.delete | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/[id]/stage` | PATCH | S: identidade ativa via helper | S: leads.edit | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/[id]/tags` | GET | S: identidade ativa via helper | S: leads.view | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/[id]/tags` | POST | S: identidade ativa via helper | S: leads.edit | S: 3 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/[id]/tags` | DELETE | S: identidade ativa via helper | S: leads.edit | S: 3 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/bulk-delete` | POST | S: identidade ativa via helper | S: leads.delete | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads/bulk-update` | POST | S: identidade ativa via helper | S: leads.edit | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads` | GET | S: identidade ativa via helper | S: leads.view | S + H: raiz; não certifica todos os vínculos | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/leads` | POST | S: identidade ativa via helper | S: leads.create | S + H: raiz; não certifica todos os vínculos | S: módulo observado | SIM: manifesto vazio; par isolado testado |

### Marketing / Projetos — 5 operações

| URL | Método | Autenticação | Permissão operacional | Isolamento | Contrato | Bloqueio comercial |
|---|---|---|---|---|---|---|
| `/api/projects/[id]` | GET | S: identidade ativa via helper | S: projects.view | S + H: ID estrangeiro negado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/projects/[id]` | PUT | S: identidade ativa via helper | S: projects.edit | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/projects/[id]` | DELETE | S: identidade ativa via helper | S: projects.delete | S: 2 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/projects` | GET | S: identidade ativa via helper | S: projects.view | S + H: raiz; não certifica todos os vínculos | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/projects` | POST | S: identidade ativa via helper | S: projects.create | S + H: raiz; não certifica todos os vínculos | S: módulo observado | SIM: manifesto vazio; par isolado testado |

### Atendimento / integrações — 61 operações

| URL | Método | Autenticação | Permissão operacional | Isolamento | Contrato | Bloqueio comercial |
|---|---|---|---|---|---|---|
| `/api/atendimento/agentes` | GET | S: identidade ativa via helper | S: atendimento.view | S: 1 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/agentes/sync` | POST | S: identidade ativa via helper | S: atendimento.edit | S: 1 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/canais/connect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 2 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/canais/email/google/authorize` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/canais/email` | GET | S: identidade ativa via helper | S: integrations.view | S: 0 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/canais/email` | DELETE | S: identidade ativa via helper | S: integrations.delete | S: 0 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/canais/providers` | GET | S: identidade ativa via helper | S: integrations.view | S: 2 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/atendimento/canais/whatsapp-cloud/connect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 1 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/canais/whatsapp-cloud/delete` | POST | S: identidade ativa via helper | S: integrations.edit | S: 1 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/equipes/[teamId]/members` | GET | S: identidade ativa via helper | S: atendimento.view | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/equipes/[teamId]/members` | POST | S: identidade ativa via helper | S: atendimento.edit | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/equipes/[teamId]/members` | DELETE | S: identidade ativa via helper | S: atendimento.edit | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/equipes/[teamId]` | DELETE | S: identidade ativa via helper | S: atendimento.delete | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/equipes` | GET | S: identidade ativa via helper | S: atendimento.view | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/equipes` | POST | S: identidade ativa via helper | S: atendimento.create | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/inboxes/[inboxId]/members` | GET | S: identidade ativa via helper | S: atendimento.view | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/inboxes/[inboxId]/members` | POST | S: identidade ativa via helper | S: atendimento.edit | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/inboxes/[inboxId]/members` | DELETE | S: identidade ativa via helper | S: atendimento.edit | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/inboxes` | GET | S: identidade ativa via helper | S: atendimento.view | S: 0 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/instagram/accounts` | GET | S: identidade ativa via helper | S: integrations.view | S: 1 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/connect` | GET | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/create-inbox` | POST | S: identidade ativa via helper | S: integrations.edit | S: 6 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/debug-business-pages` | GET | S: identidade ativa via helper | S: integrations.view | S: 1 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/debug-pages` | GET | S: identidade ativa via helper | S: integrations.view | S: 1 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/debug-token` | GET | S: identidade ativa via helper | S: integrations.view | S: 1 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/exchange-token` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram` | GET | S: identidade ativa via helper | S: integrations.view | S: 1 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram` | POST | S: identidade ativa via helper | S: integrations.edit | S: 3 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/select-account` | POST | S: identidade ativa via helper | S: integrations.edit | S: 2 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/subscribe-page` | POST | S: identidade ativa via helper | S: integrations.edit | S: 2 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/instagram/sync-account` | POST | S: identidade ativa via helper | S: integrations.edit | S: 2 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/session-diagnostics` | GET | S: identidade ativa via helper | S: atendimento.view | S: 1 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/atendimento/widget/agents` | POST | S: identidade ativa via helper | S: integrations.edit | S: 5 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/widget/provision` | POST | S: identidade ativa via helper | S: integrations.edit | S: 7 chamadas com sinal tenant; não certificado | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/widget` | GET | S: identidade ativa via helper | S: integrations.view | S + H: raiz; não certifica todos os vínculos | S: canal observado | SIM: observer não bloqueia |
| `/api/atendimento/widget` | POST | S: identidade ativa via helper | S: integrations.edit | S + H: raiz; não certifica todos os vínculos | S: canal observado | SIM: observer não bloqueia |
| `/api/integrations/chatwoot/connect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/chatwoot/credentials` | GET | S: identidade ativa via helper | S: atendimento.view | S: 3 chamadas com sinal tenant; não certificado | S: módulo observado | SIM: manifesto vazio; par isolado testado |
| `/api/integrations/chatwoot/disconnect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/chatwoot/status` | GET | S: identidade ativa via helper | S: integrations.view | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/chatwoot/team-members` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/chatwoot/teams/[teamId]` | DELETE | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/chatwoot/teams` | GET | S: identidade ativa via helper | S: integrations.view | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/chatwoot/teams` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/connect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/delete` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/disconnect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/finalize` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/instances` | GET | S: identidade ativa via helper | S: integrations.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/qrcode` | GET | S: identidade ativa via helper | S: integrations.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/reconnect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/setup-inbox` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/evolution/status` | GET | S: identidade ativa via helper | S: integrations.view | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp-cloud/setup` | POST | S: identidade ativa via helper | S: integrations.edit | S: 2 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp-cloud/setup` | DELETE | S: identidade ativa via helper | S: integrations.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp-cloud/status` | GET | S: identidade ativa via helper | S: integrations.view | S: 2 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp-cloud/validate` | POST | S: identidade ativa via helper | S: integrations.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp/connect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp/create-inbox` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp/disconnect` | POST | S: identidade ativa via helper | S: integrations.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/integrations/whatsapp/status` | GET | S: identidade ativa via helper | S: integrations.view | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |

### Callbacks / webhooks — 7 operações

| URL | Método | Autenticação | Permissão operacional | Isolamento | Contrato | Bloqueio comercial |
|---|---|---|---|---|---|---|
| `/api/atendimento/instagram/callback` | GET | S: identidade ativa via helper | S: integrations.edit | S: 2 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Política callback/lifecycle pendente; sem guard cego |
| `/api/atendimento/instagram/webhook` | GET | Protocolo provider; revisão própria | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Política callback/lifecycle pendente; sem guard cego |
| `/api/atendimento/instagram/webhook` | POST | Protocolo provider; revisão própria | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Política callback/lifecycle pendente; sem guard cego |
| `/api/webhooks/asaas` | POST | Protocolo provider; revisão própria | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Política callback/lifecycle pendente; sem guard cego |
| `/api/webhooks/chatwoot` | POST | Protocolo provider; revisão própria | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Política callback/lifecycle pendente; sem guard cego |
| `/api/webhooks/whatsapp-cloud` | GET | Protocolo provider; revisão própria | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Política callback/lifecycle pendente; sem guard cego |
| `/api/webhooks/whatsapp-cloud` | POST | Protocolo provider; revisão própria | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Política callback/lifecycle pendente; sem guard cego |

### Recursos compartilhados / plataforma — 66 operações

| URL | Método | Autenticação | Permissão operacional | Isolamento | Contrato | Bloqueio comercial |
|---|---|---|---|---|---|---|
| `/api/agenda/[id]` | GET | S: identidade ativa via helper | S: agenda.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/agenda/[id]` | PUT | S: identidade ativa via helper | S: agenda.edit | S: 4 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/agenda/[id]` | DELETE | S: identidade ativa via helper | S: agenda.delete | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/agenda` | GET | S: identidade ativa via helper | S: agenda.view | S + H: raiz; não certifica todos os vínculos | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/agenda` | POST | S: identidade ativa via helper | S: agenda.create | S + H: raiz; não certifica todos os vínculos | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/attachments/[id]` | DELETE | S: identidade ativa via helper | S: module.delete | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/attachments` | GET | S: identidade ativa via helper | S: module.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/attachments` | POST | S: identidade ativa via helper | S: module.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/[...nextauth]` | GET | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/[...nextauth]` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/delete-account` | DELETE | S: identidade ativa via helper | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/export-data` | GET | S: identidade ativa via helper | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/forgot-password` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/me` | GET | S: identidade ativa via helper | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/reset-password` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/auth/signup` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/comments/[id]` | PUT | S: identidade ativa via helper | S: module.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/comments/[id]` | DELETE | S: identidade ativa via helper | S: module.delete | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/comments` | GET | S: identidade ativa via helper | S: module.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/comments` | POST | S: identidade ativa via helper | S: module.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/coupons/validate` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals/[id]/actions/[actionId]` | PATCH | S: identidade ativa via helper | S: goals.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals/[id]/actions/[actionId]` | DELETE | S: identidade ativa via helper | S: goals.delete | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals/[id]/actions` | GET | S: identidade ativa via helper | S: goals.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals/[id]/actions` | POST | S: identidade ativa via helper | S: goals.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals/[id]` | GET | S: identidade ativa via helper | S: goals.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals/[id]` | PATCH | S: identidade ativa via helper | S: goals.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals/[id]` | DELETE | S: identidade ativa via helper | S: goals.delete | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals` | GET | S: identidade ativa via helper | S: goals.view | S + H: raiz; não certifica todos os vínculos | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/goals` | POST | S: identidade ativa via helper | S: goals.create | S + H: raiz; não certifica todos os vínculos | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/notifications/read` | POST | S: identidade ativa via helper | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/notifications` | GET | S: identidade ativa via helper | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/organizations` | GET | S: identidade ativa via helper | S: settings.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/organizations` | PATCH | S: identidade ativa via helper | S: settings.edit | S: 2 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/os/[id]` | GET | S: identidade ativa via helper | S: os.view | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/os/[id]` | PUT | S: identidade ativa via helper | S: os.edit | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/os/[id]` | DELETE | S: identidade ativa via helper | S: os.delete | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/os` | GET | S: identidade ativa via helper | S: os.view | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/os` | POST | S: identidade ativa via helper | S: os.create | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/booking/[organizationSlug]/[userSlug]/availability` | OPTIONS | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/booking/[organizationSlug]/[userSlug]/availability` | GET | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/booking/[organizationSlug]/[userSlug]/lead` | OPTIONS | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/booking/[organizationSlug]/[userSlug]/lead` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 3 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/booking/[organizationSlug]/[userSlug]` | OPTIONS | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/booking/[organizationSlug]/[userSlug]` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/briefings/[organizationSlug]` | OPTIONS | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/briefings/[organizationSlug]` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 2 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/widget/[slug]` | OPTIONS | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/public/widget/[slug]` | GET | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tags/[id]` | GET | S: identidade ativa via helper | S: leads.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tags/[id]` | PUT | S: identidade ativa via helper | S: leads.edit | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tags/[id]` | DELETE | S: identidade ativa via helper | S: leads.delete | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks/[id]` | GET | S: identidade ativa via helper | S: tasks.view | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks/[id]` | PUT | S: identidade ativa via helper | S: tasks.edit | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks/[id]` | DELETE | S: identidade ativa via helper | S: tasks.delete | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks/[id]/subtasks/[subtaskId]` | PUT | S: identidade ativa via helper | S: tasks.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks/[id]/subtasks/[subtaskId]` | DELETE | S: identidade ativa via helper | S: tasks.delete | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks/[id]/subtasks` | GET | S: identidade ativa via helper | S: tasks.view | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks/[id]/subtasks` | POST | S: identidade ativa via helper | S: tasks.edit | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks` | GET | S: identidade ativa via helper | S: tasks.view | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/tasks` | POST | S: identidade ativa via helper | S: tasks.create | **F: C5-01**; raiz não protege relações | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/usage` | GET | S: identidade ativa via helper | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/users/[id]/permissions` | PUT | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/users/[id]` | DELETE | S: identidade ativa via helper | S: users.delete | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/users/invite` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 2 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |
| `/api/users` | GET | S: identidade ativa via helper | S: users.view | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | Avaliar por recurso; plataforma não herda módulo |

### Administração MDS — 22 operações

| URL | Método | Autenticação | Permissão operacional | Isolamento | Contrato | Bloqueio comercial |
|---|---|---|---|---|---|---|
| `/api/admin/auth` | POST | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/auth` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/auth` | DELETE | Delegada/pública ou revisar manualmente | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/coupons/[id]` | PUT | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/coupons/[id]` | DELETE | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/coupons` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/coupons` | POST | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/dashboard` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/organizations/[id]` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/organizations/[id]` | PUT | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/organizations/[id]` | DELETE | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 3 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/organizations` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/organizations` | POST | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/orgs/[orgId]/provision-chatwoot` | POST | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/orgs/[orgId]/provision-chatwoot` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 1 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/plans/[id]` | PUT | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/plans/[id]` | DELETE | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/plans` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/plans` | POST | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/users/[id]` | PUT | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/users/[id]` | DELETE | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 3 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |
| `/api/admin/users` | GET | S: Super Admin | Sem permissão tenant direta detectada; revisar contexto | S: 0 chamadas com sinal tenant; não certificado | Sem observação direta detectada | N/A: autoridade MDS própria |

## Páginas — autoridade de dados não é a Sidebar

Todas herdam o layout autenticado com identidade ativa (S, negativos C0/H). As 11 URLs da matriz HTTP por cenário são Atendimento, Leads, Kanban, Agenda, Follow-ups, Metas, Projetos, OS, Tarefas, Relatórios e settings/atendimento/widget. Outras páginas têm evidência de fonte e testes anteriores, sem certificação HTTP nova por cada URL.

| URL | Autenticação | Permissão operacional | Isolamento de dados | Contrato observado | Bloqueio pendente |
|---|---|---|---|---|---|
| `/agenda` | S: identidade ativa no layout | S: UI agenda.view; servidor nas APIs | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/atendimento` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/dashboard` | S: identidade ativa no layout | S+H: permissões por indicador (C0–C2) | H: dados por organização no Dashboard C0 | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/follow-ups` | S: identidade ativa no layout | S: UI tasks.view; servidor nas APIs | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/goals` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/help/[slug]` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/help` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/kanban` | S: identidade ativa no layout | S: UI kanban.view; servidor nas APIs | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/leads` | S: identidade ativa no layout | S: UI leads.view; servidor nas APIs | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/os` | S: identidade ativa no layout | S: UI os.view; servidor nas APIs | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/projects` | S: identidade ativa no layout | S: UI projects.view; servidor nas APIs | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/reports` | S: identidade ativa no layout | S: reports.view na UI; dados via leads.view | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/settings/account` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/settings/atendimento/automacoes` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/canais/cloud-api` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/canais` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/canais/provider-lab` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/equipes` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/instagram` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/relatorios` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/respostas` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/atendimento/widget` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | S+I: guard de módulo | SIM: manifesto vazio |
| `/settings/billing` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/settings/branding` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/settings/integrations` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/settings/members` | S: identidade ativa no layout | Delegada a filhos/API; não certificada por shell | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |
| `/tasks` | S: identidade ativa no layout | S: UI tasks.view; servidor nas APIs | Layout valida vínculo; dados dependem das APIs, C5-01/02 se compartilhados | Apresentação/compartilhado, sem guard específico | Política por recurso; não inferir dono comercial |

## Antes de autorizar rollout

1. Corrigir C5-01 e C5-02 e fazer os dois probes retornarem zero; manter regressões C0–C4. Revisar registros legados inválidos de forma autorizada e reversível, sem apagar dados automaticamente.
2. Aprovar a política de compartilhados e completar a integração das APIs/canais fora dos pares atuais, com testes de todas as operações sensíveis e callbacks. Não usar uma única flag para presumir cobertura total.
3. Homologar permissões parciais, snapshots divergentes, nomes/estados de plano e identificadores legados; inventário real ainda depende de acesso/escopo autorizado. Não copiar Plan.features em massa.
4. Fazer revisão independente e definir tenant piloto, evidência, janela, monitoramento e rollback antes de inserir qualquer aprovação no manifesto. Esta auditoria não autoriza essa inserção, C6, push, merge ou deploy.

Nenhum G1–G6 é declarado aprovado. G2/G3 têm falhas novas confirmadas; G5/rollout têm lacunas de cobertura/compatibilidade; G6 mantém revisão independente e CI remota pendentes. A suíte existente de G1/G4 e o branding C3/C4 passando não substituem esses bloqueadores.
