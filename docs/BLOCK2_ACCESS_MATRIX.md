# Bloco 2 — Matriz de acesso e inventário de superfícies

> **Revisão C5 SECURITY — 2026-10-21:** [matriz original](BLOCK2_C5_ACCESS_AUDIT_2026-10-21.md) e [correção pontual/evidências atuais](BLOCK2_C5_SECURITY_FIX_2026-10-21.md). Inventário: 116 APIs, 177 métodos, 28 páginas; 35 guards de módulo e 22 observers de canal. P0/P1 demonstrados corrigidos em `a9aa6ed`: **42 expectativas cross-tenant PASS, zero notificações estrangeiras e zero vazamentos de Lead nos 84 cenários**. **Rollout ainda bloqueado** por cobertura comercial/compatibilidade pendentes. Observe_only e manifesto vazio preservados. A matriz histórica abaixo não constitui aprovação nem certificação de todos os métodos; C6 não iniciado.

Base da matriz original: `f93c3435fff316a548255993d749ef545c9c7670`. Revisão documental e HTTP anterior: `9e2a785a9cdbcf5502991e3d5853d29b8685e27a`, com os 12 canônicos recebidos em `docs/oficiais/` e origem preservada em `ORIGEM.md`. Esta matriz é inventário de código, não homologação de segurança de todas as rotas. Nenhuma consulta de produção foi executada.

## Decisões e limites de cobertura

- Marketing: `MarketingProject` possui tabela própria e APIs/página de projetos. Integração server-side aditiva somente em `/projects`, `/api/projects` e `/api/projects/[id]`, inicialmente observe_only.
- Vendas: Leads e Pipeline Comercial integrados em observe_only na continuidade baseada em `d9ac1fe1b8e8406489c2158e5c26186580544ef7`: nove APIs, 16 métodos e layouts específicos de `/leads` e `/kanban`. Permissões operacionais, filtros tenant e sessão são obrigatórios; decisões comerciais não bloqueiam. Cadastro isolado de tags e compartilhados continuam fora deste recorte.
- Tarefas, agenda, OS, metas, comentários e anexos têm relações/uso compartilhados. A permissão `projects` em algumas entidades não prova que todos os seus dados sejam exclusivamente Marketing. O bloco não amplia a classificação por suposição.
- Atendimento e providers têm permissões operacionais distintas de `integrations`; callbacks/webhooks não devem receber guards de sessão de usuário indiscriminadamente. Nenhum lifecycle, inbox ou provider será alterado.
- Dashboard, usuários, notificações, billing, branding, ajuda e relatórios são plataforma/compartilhados; exigem decisão por recurso antes de enforcement comercial. Branding por tenant ainda requer revisão de governança.
- Financeiro e agentes_ia: catálogo planejado, sempre indisponíveis para operação.
- Sem enforcement global ou por tenant habilitado. Manifesto servidor de aprovações começa vazio e não aceita flags/IDs do frontend.

## Roles e permissões operacionais atuais

`getDefaultPermissions` em `src/lib/permissions.ts` é a fonte de defaults: owner e admin possuem amplos direitos; manager varia por seção; user normalmente visualiza/cria Leads/Tarefas/Agenda, somente visualiza Projetos/OS/Kanban/Relatórios/Metas/Atendimento e não gerencia Integrações/Configurações/Usuários. Admin não pode excluir Configurações/Usuários; owner tem todas as ações nos defaults. Defaults não são direitos comerciais.

O helper legado permite owner após verificar usuário/tenant. O motor novo avaliará módulo e assinatura antes da permissão individual, sem bypass por role. Permissões customizadas atuais serão lidas do banco a cada avaliação; uma configuração malformada produzirá decisão controlada de permissão insuficiente, nunca fallback universal.

Super Admin usa cookie e JWT separados. Sua autoridade deve ser explícita para operação administrativa e tenant alvo determinado pelo servidor; não equivale a login como usuário de outra organização. Os handlers de planos do complemento continuam com `role === superadmin`.

## Contrato de autorização e modo

Identidade da sessão verificada no servidor → usuário fresco → vínculo exato/soft-delete → organização fresca → assinatura → módulo Bloco 1 → permissão individual → regras adicionais de recurso/limite. A decisão teórica é sempre discriminada e falha fechada. O adapter observe_only registra o resultado e devolve exatamente a autorização legada previamente calculada; não converte falha de infraestrutura em nova concessão. Em enforce homologado, uma decisão negativa interrompe a operação. As consultas/mutações continuam obrigadas a filtrar organizationId; um guard de módulo não substitui propriedade de recurso.

## Inventário de APIs

Cobertura de descoberta: 116 arquivos route.ts. Colunas de guard/scope são evidência estática, não prova de completude ou ausência de IDOR. `orgRefs` é contagem de ocorrências e não comprova isolamento.

| API | Métodos | Classificação | Guarda/observação | Integração |
| --- | --- | --- | --- | --- |
| `/api/admin/auth` | POST, GET, DELETE | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/coupons/[id]` | PUT, DELETE | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/coupons` | GET, POST | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/dashboard` | GET | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/organizations/[id]` | GET, PUT, DELETE | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/organizations` | GET, POST | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/orgs/[orgId]/provision-chatwoot` | POST, GET | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/plans/[id]` | PUT, DELETE | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/plans` | GET, POST | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/users/[id]` | PUT, DELETE | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/admin/users` | GET | Administração explícita | Admin JWT; não é bypass de tenant | Legado; planos regressão preservada |
| `/api/agenda/[id]` | GET, PUT, DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/agenda` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/atendimento/agentes` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/agentes/sync` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/canais/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/canais/email/google/authorize` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/canais/email` | GET, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/canais/providers` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/canais/whatsapp-cloud/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/canais/whatsapp-cloud/delete` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/equipes/[teamId]/members` | GET, POST, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/equipes/[teamId]` | DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/equipes` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/inboxes/[inboxId]/members` | GET, POST, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/inboxes` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/accounts` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/callback` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/connect` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/create-inbox` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/debug-business-pages` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/debug-pages` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/debug-token` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/exchange-token` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/select-account` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/subscribe-page` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/sync-account` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/instagram/webhook` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/session-diagnostics` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/widget/agents` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/widget/provision` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/atendimento/widget` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/attachments/[id]` | DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/attachments` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/auth/[...nextauth]` | GET, POST | Autenticação/conta | NextAuth ou fluxo público próprio | CORE protegido; sem alteração |
| `/api/auth/delete-account` | DELETE | Autenticação/conta | NextAuth ou fluxo público próprio | CORE protegido; sem alteração |
| `/api/auth/export-data` | GET | Autenticação/conta | NextAuth ou fluxo público próprio | CORE protegido; sem alteração |
| `/api/auth/forgot-password` | POST | Autenticação/conta | NextAuth ou fluxo público próprio | CORE protegido; sem alteração |
| `/api/auth/me` | GET | Autenticação/conta | NextAuth ou fluxo público próprio | CORE protegido; sem alteração |
| `/api/auth/reset-password` | POST | Autenticação/conta | NextAuth ou fluxo público próprio | CORE protegido; sem alteração |
| `/api/auth/signup` | POST | Autenticação/conta | NextAuth ou fluxo público próprio | CORE protegido; sem alteração |
| `/api/comments/[id]` | PUT, DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/comments` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/coupons/validate` | POST | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/goals/[id]/actions/[actionId]` | PATCH, DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/goals/[id]/actions` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/goals/[id]` | GET, PATCH, DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/goals` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/import` | POST | Vendas | leads:create | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/integrations/chatwoot/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/chatwoot/credentials` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/chatwoot/disconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/chatwoot/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/chatwoot/team-members` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/chatwoot/teams/[teamId]` | DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/chatwoot/teams` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/delete` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/disconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/finalize` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/instances` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/qrcode` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/reconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/setup-inbox` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/evolution/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/whatsapp/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/whatsapp/create-inbox` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/whatsapp/disconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/whatsapp/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/whatsapp-cloud/setup` | POST, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/whatsapp-cloud/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/integrations/whatsapp-cloud/validate` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | CORE/provider: revisão específica e validação operacional pendentes |
| `/api/kanban/stages/[key]` | PUT, DELETE | Vendas | kanban:edit/delete | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/kanban/stages` | GET, POST | Vendas | kanban:view/create | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/leads/[id]` | GET, PUT, DELETE | Vendas | leads:view/edit/delete | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/leads/[id]/stage` | PATCH | Vendas | leads:edit | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/leads/[id]/tags` | GET, POST, DELETE | Vendas | leads:view/edit/edit | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/leads/bulk-delete` | POST | Vendas | leads:delete | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/leads/bulk-update` | POST | Vendas | leads:edit | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/leads` | GET, POST | Vendas | leads:view/create | Integrado: legado + decisão Vendas observada; tenant obrigatório |
| `/api/notifications/read` | POST | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/notifications` | GET | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/organizations` | GET, PATCH | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/os/[id]` | GET, PUT, DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/os` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/projects/[id]` | GET, PUT, DELETE | Marketing | projects + entitlement marketing | Integração observe_only neste bloco |
| `/api/projects` | GET, POST | Marketing | projects + entitlement marketing | Integração observe_only neste bloco |
| `/api/public/booking/[organizationSlug]/[userSlug]/availability` | GET | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |
| `/api/public/booking/[organizationSlug]/[userSlug]/lead` | POST | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |
| `/api/public/booking/[organizationSlug]/[userSlug]` | POST | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |
| `/api/public/briefings/[organizationSlug]` | POST | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |
| `/api/public/widget/[slug]` | GET | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |
| `/api/tags/[id]` | GET, PUT, DELETE | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/tasks/[id]` | GET, PUT, DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/tasks/[id]/subtasks/[subtaskId]` | PUT, DELETE | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/tasks/[id]/subtasks` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/tasks` | GET, POST | Compartilhado/a classificar | Permissão existente + contexto do recurso | Não atribuir automaticamente a Vendas |
| `/api/usage` | GET | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/users/[id]/permissions` | PUT | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/users/[id]` | DELETE | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/users/invite` | POST | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/users` | GET | Plataforma/compartilhado | Permissão/identidade atual | Legado; classificação específica pendente |
| `/api/webhooks/asaas` | POST | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |
| `/api/webhooks/chatwoot` | POST | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |
| `/api/webhooks/whatsapp-cloud` | GET, POST | Público/webhook | Contrato público/assinatura específico | Suspenso: fora de sessão de usuário |

## Páginas e renderização

A shell `(app)/layout.tsx` carrega branding com sessão, mas não é guard granular. Middleware declara proteção de parte das páginas usando JWT; não cobre todas as APIs e a execução precisa de homologação. Layout de administração é client-side e depende das proteções servidor/API existentes. Não tratar menu oculto como autorização.

Revisão HTTP com documentação oficial: o 200 histórico foi reproduzido apenas no dev e continha shell genérica/loading, sem projetos no HTML capturado; o build local já redirecionava (307). A descoberta de middleware no dev com `src/app` consulta `src/middleware`, enquanto o arquivo atual está na raiz. Sem mover esse arquivo global, o guard servidor de Projetos agora exige sessão antes da política comercial. Resultado final sem sessão: página 307, API 401, login 200 em dev e build local. Observe_only continua aplicável às decisões comerciais, não à ausência de identidade.

| Página | Classificação | Integração/pendência |
| --- | --- | --- |
| `/agenda` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/atendimento` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/dashboard` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/follow-ups` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/goals` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/help/[slug]` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/help` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/kanban` | Vendas | Layout servidor: sessão obrigatória + decisão Vendas/kanban:view observada; tela e DnD preservados |
| `/leads` | Vendas | Layout servidor: sessão obrigatória + decisão Vendas/leads:view observada; tela/store preservados |
| `/os` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/projects` | Marketing | Sessão exigida no servidor; decisões comerciais observe_only |
| `/reports` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/settings/account` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/settings/atendimento/automacoes` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/canais/cloud-api` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/canais` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/canais/provider-lab` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/equipes` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/instagram` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/relatorios` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/respostas` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/atendimento/widget` | Atendimento/providers | Documentação recebida; alteração exige revisão operacional específica |
| `/settings/billing` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/settings/branding` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/settings/integrations` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/settings/members` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/tasks` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/admin/coupons` | Administração | Middleware/API legados; sem novo bypass |
| `/admin/dashboard` | Administração | Middleware/API legados; sem novo bypass |
| `/admin/login` | Administração | Middleware/API legados; sem novo bypass |
| `/admin/organizations` | Administração | Middleware/API legados; sem novo bypass |
| `/admin/plans` | Administração | Middleware/API legados; sem novo bypass |
| `/admin/users` | Administração | Middleware/API legados; sem novo bypass |
| `/auth/forgot-password` | Autenticação | Protegido; inalterado |
| `/auth/login` | Autenticação | Protegido; inalterado |
| `/auth/logout` | Autenticação | Protegido; inalterado |
| `/auth/reset-password` | Autenticação | Protegido; inalterado |
| `/auth/signup` | Autenticação | Protegido; inalterado |
| `/` | Público/entrada | Contrato atual preservado |
| `/privacy` | Público/entrada | Contrato atual preservado |
| `/terms` | Público/entrada | Contrato atual preservado |

## Lacunas com evidência e bloqueios

- `auth.ts`: JWT é atualizado com dados frescos, mas catch de banco mantém claims anteriores. O motor novo não confiará nesses claims para role/features; login e callback permanecem intactos.
- `checkLimits.ts`: catches permissivos e `<= 0` como ilimitado são preexistentes. Não reutilizar o allowed do catch como prova de limite no motor novo.
- `api/atendimento/instagram/exchange-token/route.ts`: lê organizationId do body e atualiza settings, sem guard de sessão no fonte examinado. Tratar como bloqueio de revisão específica de provider, não testar em serviço real nem corrigir improvisadamente.
- `api/admin/orgs/[orgId]/provision-chatwoot/route.ts`: verificação JWT própria, sem validação explícita de role no helper local. Alteração suspensa por afetar provisionamento.
- `api/comments/[id]/route.ts`: busca global por id antes de checar permissão/autoria; o vínculo organizationId não é explicitamente testado nesse caminho. Revisar em tarefa de recurso compartilhado.
- `api/tasks/route.ts`: relações projectId/leadId/assignedToId e contagens de entidades exigem revisão multitenant contextual; coluna organizationId isoladamente não impede associação cruzada por FK simples.
- Projetos: GET e pré-checks por id já filtram organizationId; PUT/DELETE usam id sozinho depois do pré-check. Neste bloco a mutação final também será condicionada ao tenant, sem alterar campos de negócio.

Nenhuma das lacunas suspensas é declarada corrigida. A documentação canônica agora está disponível; regras contextuais, revisão específica e validação operacional são requisitos para integrar essas áreas; a cobertura parcial impede ativação segura mesmo se a nova função isolada passar nos testes.

## Matriz explícita de defaults por role

V=view, C=create, E=edit, D=delete; —=nenhuma ação. Permissões customizadas do usuário prevalecem conforme contrato existente. Nenhuma célula concede entitlement comercial.

| Permissão operacional | owner | admin | manager | user |
| --- | --- | --- | --- | --- |
| `leads` | VCED | VCED | VCE | VC |
| `tasks` | VCED | VCED | VCED | VC |
| `projects` | VCED | VCED | VCE | V |
| `os` | VCED | VCED | VCE | V |
| `agenda` | VCED | VCED | VCED | VC |
| `kanban` | VCED | VCED | VCE | V |
| `reports` | VCED | VCED | V | V |
| `goals` | VCED | VCED | VCE | V |
| `integrations` | VCED | VCED | V | — |
| `settings` | VCED | VCE | — | — |
| `users` | VCED | VCE | V | — |
| `atendimento` | VCED | VCED | VCED | V |

Rota pública fora de `/api`: `/widget/loader.js` (`src/app/widget/loader.js/route.ts`), GET de script público. Preservada; não recebe guard de sessão. O inventário cobre 116 arquivos em `/api` e esse endpoint público adicional.

## Confronto com os 12 documentos oficiais recebidos

Leitura integral concluída; nomes, origem e SHA-256 em `oficiais/ORIGEM.md` e no índice recebido. O pacote não é atualizado silenciosamente para o estado atual do código. Os bloqueios abaixo passaram de ausência de documento para dependências concretas de decisão/validação.

| Domínio/recurso | Evidência oficial + código | Continuidade segura nesta missão | Dependência restante |
| --- | --- | --- | --- |
| Atendimento | 01/04/7/8/9: iframe/backend operacional, 1 número/1 inbox, providers separados | Auditar contratos e preservar os fontes; nenhuma alteração de iframe, credenciais, dispatcher ou lifecycle | Revisão por endpoint e ambiente externo de teste homologável; autorização não deve substituir callbacks/webhooks por sessão de usuário |
| Vendas | 01/03/9/17: Lead, LeadPipelineStage, Tag/LeadTag e pipeline comercial; `/kanban` importa useLeadsStore | Integração dos nove handlers e dois layouts autorizada na missão Vendas e testada isoladamente | PIPELINE é CORE alto; homologação browser autenticada/operacional e revisão independente continuam pendentes; sem enforcement |
| Marketing | 17: MarketingProject e estruturas KanbanBoard/Column/Card de execução | Manter integração existente de Projetos e corrigir somente a ausência de sessão na página | Não confundir esses modelos com a tela comercial `/kanban`; não ativar enforcement ou criar campanhas |
| Tasks/Subtasks e Agenda | 9/17 + Prisma: relações com lead e projeto; filhos herdam escopo do pai | Documentar como compartilhados/contextuais | Aprovar regra por entidade/relacionamento e testar criação/edição/filtros antes de guards comerciais |
| OS/ServiceOrder | 17: execução operacional, vínculo opcional a projeto | Manter classificação operacional, sem atribuição automática a Vendas | Decisão de acesso compartilhado/por vínculo e testes de regressão |
| Metas | 17: metas comerciais (Goal/GoalAction) | Registrar domínio comercial confirmado, sem supor que a permissão operacional projects equivale ao entitlement marketing | Aprovar mapeamento de permissão/entitlement e limites legados; não reclassificar em código silenciosamente |
| Dashboard/Relatórios/Notificações/Membros/Configurações | 9: múltiplas dependências e Auth/Users como alto impacto | Plataforma/compartilhados; regras atuais preservadas | Composição de autorização por origem de dado, sessão e contexto; nenhum guard global indiscriminado |

As regras gerais de isolamento não tornam obrigatório adicionar organizationId a cada model filho: no schema atual Subtask/GoalAction/Column/Card dependem de entidades pai. Toda operação deve demonstrar escopo pelo ancestral correto; qualquer alteração estrutural de persistência exige decisão própria, conforme 17. Nenhuma FK ou model foi alterado aqui.

A indisponibilidade documental original foi resolvida. Isso não homologa integrações externas, elimina as lacunas de IDOR já listadas ou autoriza migração/enforcement. Na revisão documental anterior, a cobertura não foi ampliada além de Projetos. A continuidade Vendas autorizada posteriormente está descrita a seguir.

## Continuidade Vendas — contratos e limites do recorte

Base `d9ac1fe1b8e8406489c2158e5c26186580544ef7`. As permissões na tabela seguem a ordem dos métodos HTTP da respectiva linha. PATCH stage é leads:edit, conforme contrato operacional atual; gerenciar etapas é kanban:create/edit/delete. Não acrescentar kanban:edit à movimentação silenciosamente. Cadastro de tags `/api/tags...` permanece legado fora da lista autorizada; associação `/api/leads/[id]/tags` está integrada.

- API: checkModulePermission mantém checkPermission legado antes de observar. Sem sessão, usuário removido, organização inválida/inativa ou permissão operacional não há acesso a recurso. Sem assinatura/módulo a decisão nova nega, inclusive owner/admin, mas o efeito comercial continua observe_only. CheckPlanActive/checkOrganizationLimit anteriores de criação permanecem ativos e suas respostas não mudam.
- Identidade: organizationId vem somente da sessão validada, nunca query/header/body. Mutações finais de Lead e LeadPipelineStage repetem tenant. Etapa é identificada por key dentro da organização; a mesma key pode existir em tenants diferentes.
- Lotes: contrato integral preservado (IDs misturados/inexistentes/duplicados → 400, nenhuma escrita); mutação final por organizationId + id in ids. Import mantém sucesso/falhas/total por linha e allowlist de campos, ignorando organizationId/assignedToId/createdById/provider enviados pelo cliente.
- Associações: responsável novo/reafirmado deve ser usuário ativo do tenant; null/omissão não exige reparar legado. LeadTag filtra os dois pais; connect/upsert e delete repetem escopo. Projeções opcionais de responsável/autor e coleções tarefas/conversas têm filtro próprio de organização, evitando revelar relações antigas indevidas sem migrá-las.
- Compatibilidade de status: Lead.status é string sem FK. Códigos nativos/aliases históricos continuam; etapa customizada precisa ser local, ou status já usado em Lead do tenant. Texto novo não reconhecido → 400, ou falha da linha no import. Não cria etapa nem altera dados existentes; PUT sem status permite edição parcial. Bulk mantém seu enum antigo. Copiar um texto que já é status local não dá acesso ao objeto Stage de outro tenant. Valores órfãos já locais não são reparados nesta missão.
- Frontend: layouts seguem o guard de Projects, com redirect login sem sessão e sem enforcement comercial. Componentes client, Sidebar, formulários e store não mudaram. Controle operacional dos dados permanece nas APIs e controle visual preexistente permanece no cliente.

Escopo seguinte: Atendimento depende de revisão endpoint a endpoint de identidade operacional, isolamento provider, callback/webhook versus sessão, risco, rollback e ambiente próprio. Task/Agenda/OS/metas/relatórios/comentários/anexos continuam compartilhados com regras por recurso pendentes. Inventário real, política legada, cobertura integral, homologação independente e aprovação explícita são pré-requisitos de qualquer manifesto futuro. Manifesto atual vazio; Bloco 2 parcial, Bloco 3 não iniciado.

## Suplemento de evidências — auditoria estática de Atendimento

Base fixa: `2649d3f491e27c82e7467709c0796c4f5c92c1d0`. Esta revisão acrescenta evidências; não altera a classificação dos demais recursos nem declara resolvidas as lacunas anteriores. Nenhuma rota de Atendimento foi integrada nesta missão.

Inventário detalhado em [BLOCK2_ATENDIMENTO_AUDIT.md](BLOCK2_ATENDIMENTO_AUDIT.md): 58 arquivos/72 métodos principais, 11 páginas, nove arquivos/12 métodos compartilhados e 15 fluxos internos, com referências de código por arquivo/linha, provider, autenticação/permissão, tenant, efeitos, dependências e risco. [Plano incremental](BLOCK2_ATENDIMENTO_IMPLEMENTATION_PLAN.md) separa A1/A2 humanas, B técnicas, C providers/lifecycle e D compartilhados, com bloqueios, testes futuros, impacto e rollback.

| Evidência verificada na base | Identidade/provider/contrato | Consequência para autorização modular |
| --- | --- | --- |
| `src/app/api/atendimento/agentes`, `equipes`, `inboxes`, `session-diagnostics` e `integrations/chatwoot/credentials` | Humanos NextAuth + checkPermission atendimento:*; sync é POST humano. Credentials gera SSO, diagnostics solicita link Platform; não são apenas leituras locais. | A1 é candidata após recorte aprovado; SSO/iframe é CORE máximo e depende de H05. Guard de módulo não substitui ACL nativa de agente. |
| Canais/setup/widget/ações humanas Instagram e aliases integrations/chatwoot | Humanos com integrations:view/edit/delete; teams alternativos usam integrations:edit onde atendimento/equipes usa create/delete. | Motor aceita atualmente atendimento só com permission atendimento. Par atendimento/integrations precisa de decisão nominal; não renomear permissão nem integrar genericamente agora (M04). |
| `src/app/api/webhooks/whatsapp-cloud/route.ts:40`, inbound Cloud | C externo; GET verifica token de handshake, POST sem validação de assinatura no handler/helpers antes de writes externos. | C01 crítico: recepção/observação acoplada suspensa até proposta própria de autenticação; jamais exigir sessão humana/cobrança para receber. |
| `src/app/api/webhooks/chatwoot/route.ts:54`, dispatcher/outbound Cloud | C externo; segredo ausente permite evento. Conta/inbox Cloud podem acionar envio Graph usando conteúdo/destinatário do payload. | C02 crítico condicional; configuração real não inspecionada. Não ampliar dispatcher/receptor nem presumir que account_id autentica origem. |
| `api/admin/orgs/[orgId]/provision-chatwoot`, `lib/admin-auth.ts` | JWT administrativo só validado por assinatura, com fallback literal se ambos secrets faltam; role/existência não revalidados nesses caminhos. | C03 crítico condicional: autoridade administrativa exige recorte próprio; nenhum login tenant ou entitlement de cliente substitui SuperAdmin verificado. |
| `api/auth/signup/route.ts:95` | Cadastro público reativa usuário/org inativo por e-mail, troca senha e role owner sem prova de posse visível; chama provisionamento. | C04 crítico de CORE compartilhado: suspender expansão de reativação/provisionamento, registrar correção específica de Auth. Não alterar signup nesta missão. |
| `api/atendimento/instagram/webhook`, `callback`, `exchange-token` | C: POST de evento sem assinatura; state OAuth só base64url/Zod; troca alternativa aceita organização do body sem guard. | H01/H02: identidades externas não viram NextAuth; definir autenticidade/vínculo antes da integração. Efeito humano da troca alternativa não está autenticado. |
| `api/integrations/evolution/qrcode` | A com integrations:view; instanceName livre da query chega ao cliente técnico global sem verificar tenant; QR pode iniciar connect. | H03: ownership/provider antes de qualquer chamada externa; wrapper comercial observado não corrige essa lacuna. |
| `api/atendimento/instagram/debug-business-pages` | Graph pede access_token e resposta bruta vai ao leitor integrations:view. | H04: risco de exposição de page tokens; plano de diagnóstico suspenso para projeção segura, sem usar valor real como evidência. |
| `channel-lifecycle.ts`, Cloud inbound/connect, settings Instagram | Shared WhatsappInstance com provider em metadata; selectors Evolution sem filtro provider, Cloud/Instagram escolhem primeiro vínculo externo; falta unicidade/prova de posse completa. | H06/H07/H08: isolamento não pode ser presumido pelo nome da rota. Sem nova quota, schema, migração ou mudança de lifecycle nesta auditoria. |
| `/api/integrations/evolution/instances`, `/status`, `channel-status.ts` | A→B: GET pode espelhar legado/gravar runtime; listagem/status agregam Cloud, banner é compartilhado. | Não tratar como leituras puras ou gate global de Atendimento; A2/C/D e risco de concorrência devem ser revistos. |
| `/atendimento` e settings/atendimento | Onze páginas; nenhum layout específico na base. Iframe tem gate client e credencial protegida; placeholders não são funcionalidades operacionais novas. | Não deduzir proteção HTTP pelo matcher. Layout futuro por recorte; Auth/middleware e componentes protegidos permanecem intocados. |
| Widget público/loader, Email/Google e Evolution nativo | P visitante/SDK público; OAuth Email no Chatwoot; Evolution usa /chatwoot/set, sem webhook Evolution local encontrado. | Preservar identidade pública/técnica e transporte específico; não aplicar guard humano a webhook/visitor ou criar endpoint por suposição. |

Os links fixos e achados completos C01–C04/H01–H10/M01–M07/P01 estão na auditoria. O relatório diferencia fato estático, condição de exploração e dependência de validação externa; não houve teste de provider, sessão externa, credencial, dado real ou banco para confirmar cenário de produção. Críticos bloqueiam planos que os agravem, não são declarados corrigidos.

Fonte comercial preservada: Organization.features; módulo atendimento disponível sem bypass owner/admin na decisão nova; canais são IDs sem quantidade persistida contratada. -1/0/positivo legados e futuro contrato não negativo continuam distintos. Manifesto vazio; nenhum enforcement, quota ou Bloco 3 iniciado. Encerrar na entrega documental e aguardar auditoria independente e autorização da implementação.
