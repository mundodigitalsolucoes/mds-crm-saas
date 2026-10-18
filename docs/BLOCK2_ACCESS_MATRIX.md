# Bloco 2 — Matriz de acesso e inventário de superfícies

Base auditada: `f93c3435fff316a548255993d749ef545c9c7670`. Esta matriz é inventário de código, não homologação de segurança de todas as rotas. Nenhuma consulta de produção foi executada.

## Decisões e limites de cobertura

- Marketing: `MarketingProject` possui tabela própria e APIs/página de projetos. Integração server-side aditiva somente em `/projects`, `/api/projects` e `/api/projects/[id]`, inicialmente observe_only.
- Vendas: leads, tags de leads, importação e estágios de pipeline são mapeáveis por código. Alterações no pipeline aguardam documentos de CORE indispensáveis; não modificar handlers/Sidebar como atalho.
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
| `/api/atendimento/agentes` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/agentes/sync` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/canais/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/canais/email/google/authorize` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/canais/email` | GET, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/canais/providers` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/canais/whatsapp-cloud/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/canais/whatsapp-cloud/delete` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/equipes/[teamId]/members` | GET, POST, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/equipes/[teamId]` | DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/equipes` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/inboxes/[inboxId]/members` | GET, POST, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/inboxes` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/accounts` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/callback` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/connect` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/create-inbox` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/debug-business-pages` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/debug-pages` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/debug-token` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/exchange-token` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/select-account` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/subscribe-page` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/sync-account` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/instagram/webhook` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/session-diagnostics` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/widget/agents` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/widget/provision` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/atendimento/widget` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
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
| `/api/import` | POST | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/integrations/chatwoot/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/chatwoot/credentials` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/chatwoot/disconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/chatwoot/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/chatwoot/team-members` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/chatwoot/teams/[teamId]` | DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/chatwoot/teams` | GET, POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/delete` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/disconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/finalize` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/instances` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/qrcode` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/reconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/setup-inbox` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/evolution/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/whatsapp/connect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/whatsapp/create-inbox` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/whatsapp/disconnect` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/whatsapp/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/whatsapp-cloud/setup` | POST, DELETE | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/whatsapp-cloud/status` | GET | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/integrations/whatsapp-cloud/validate` | POST | Atendimento/providers | Permissões existentes; callbacks exigem revisão própria | Suspenso: documentação CORE/provider ausente |
| `/api/kanban/stages/[key]` | PUT, DELETE | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/kanban/stages` | GET, POST | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/leads/[id]` | GET, PUT, DELETE | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/leads/[id]/stage` | PATCH | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/leads/[id]/tags` | GET, POST, DELETE | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/leads/bulk-delete` | POST | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/leads/bulk-update` | POST | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
| `/api/leads` | GET, POST | Vendas | leads/kanban conforme ação | Mapeado; pipeline preservado, integração pendente revisão CORE |
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

Ressalva de execução: embora o middleware declare os matchers, GET sem sessão para `/projects` no servidor dev retornou **200**, com decisão `unauthenticated` registrada em observe_only. Não presumir bloqueio efetivo desse frontend nem extrapolar para produção. A proteção de renderização deve ser homologada após revisão do middleware/CORE.

| Página | Classificação | Integração/pendência |
| --- | --- | --- |
| `/agenda` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/atendimento` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/dashboard` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/follow-ups` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/goals` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/help/[slug]` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/help` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/kanban` | Vendas | Mapeado, pipeline preservado |
| `/leads` | Vendas | Mapeado, pipeline preservado |
| `/os` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/projects` | Marketing | Novo layout servidor observe_only |
| `/reports` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/settings/account` | Plataforma/compartilhado | Classificação e regra por recurso pendentes |
| `/settings/atendimento/automacoes` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/canais/cloud-api` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/canais` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/canais/provider-lab` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/equipes` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/instagram` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/relatorios` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/respostas` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
| `/settings/atendimento/widget` | Atendimento/providers | Alteração suspensa sem documentação indispensável |
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

Nenhuma das lacunas suspensas é declarada corrigida. A documentação canônica de CORE/providers e regras compartilhadas é requisito para integrar essas áreas; a cobertura parcial impede ativação segura mesmo se a nova função isolada passar nos testes.

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
