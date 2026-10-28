# Plano mínimo para aprovação — Bloco 02 e adaptação comercial

**Referência:**audit/block2-sanitized em f1975c9b437b78600328bba5641062e997ae1c58. **Natureza:**plano, sem implementação. Datas em America/Sao_Paulo,20/10/2026. Aprovar o plano não equivale a autorizar push, merge, deploy, migration em produção ou enforcement.

## Decisões técnicas verificadas

- Reutilizar FEATURE_CATALOG, resolveCommercialEntitlements e getOrganizationEntitlements. Organization.features continua snapshot explícito; Plan.features não vira fallback e nome do plano não concede direitos.
- Reutilizar checkAuth/checkPermission, parsePermissions/hasPermission, createModuleAuthorizer/evaluateModuleAccess e os guards existentes. Não criar permissão paralela nem remover o privilégio operacional do owner globalmente.
- Reutilizar Organization.logo/favicon/primaryColor/secondaryColor/name, getOrgBranding/brandingCssVars e as telas/APIs existentes. Sem outra tabela/banco/CRM e sem migration para esses campos.
- Super Admin MDS usa autenticação administrativa própria; owner/admin tenant não são Super Admin. Administração de Plan.features/capacidades permanece no editor atual.
- Relatório crítico identifica bloqueio P1 no Dashboard: identidade removida e permissão Leads negada ainda recebem dados. **C0 é pré-requisito**, separado do enforcement comercial.

## Estágio de execução e política efetiva

| Controle | Agora / preparação proposta | Após autorização específica de promoção |
| --- | --- | --- |
| Identidade ativa, tenant e permissão operacional | Obrigatórios em qualquer modo; corrigir o Dashboard após aprovação de C0 | Permanecem obrigatórios |
| Direito comercial de módulo/capacidade | Resolver produz decisão proposta; contrato não bloqueia silenciosamente em observe_only | Guards e projeção aplicam decisão apenas no tenant explicitamente aprovado |
| Sidebar e conteúdo comercial do Dashboard | Preparar/testar apresentação contratual em fixtures; preservar comportamento comercial legado efetivo em observe_only, mantendo permissões operacionais | Ocultar seções e não consultar dados de módulo ausente conforme contrato aprovado |
| Branding e edição comercial | Preparar leitura/governança e testes; não retirar silenciosamente branding/edição de legados nem aplicar nova identidade global | White-Label contratado aplica ativos e MDS controla os campos comerciais do grupo aprovado |
| APPROVED_ENFORCEMENTS | **Continua vazio**, sem mudança no manifesto | Somente outra autorização, inventário e referência de aceite permitem alteração |

Aprovação deste lote permite preparar código/testes, não efetivar bloqueio comercial. Não haverá flag em query/header/body/env que habilite enforce, rota de preview pública ou permissão de frontend capaz de promovê-lo. Testes podem injetar modo em funções puras/adaptadores isolados; o runtime deve sempre obter o modo no manifesto servidor atual. Prévia/teste de menu correto não será relatada como enforcement em produção.

## Plano de arquivos e commits propostos

Um commit por objetivo, com verificação antes do próximo. Nomes abaixo são propostos; nenhum deles foi executado nesta rodada.

| Commit | Objetivo e arquivos previstos | Testes/evidência para aceitar o commit |
| --- | --- | --- |
| **C0 fix(security): validate dashboard membership and resource permissions** | src/app/(app)/layout.tsx e src/app/(app)/dashboard/page.tsx: checkAuth antes de branding/dados; permissões existentes antes de consultar cada classe de indicador. Não alterar helper global de Auth, middleware ou iframe. Novos tests/block2-dashboard-postgres.test.mjs e tests/authorization-dashboard.test.ts | Reproduzir os3 negativos HTTP atuais, controle ativo e DB indisponível; nenhuma consulta métrica/dado/HTML/RSC de Lead quando negado; SSR/redirect seguro,2 tenants, role atual e reload. Regressão de shell/Atendimento e APIs preservada |
| **C1 feat(commercial): project the existing authenticated contract** | Novo adaptador fino src/lib/authorization/application-context.ts; integrar no layout. Importa checkAuth/checkPermission, resolver/organization e policy, sem reimplementar parser/entitlement. DTO tipado só com decisões de apresentação, modo e identidade visual validada, sem token/segredo ou tenant arbitrário do cliente. tests/commercial-application-context.test.ts |14 combinações, features inválidas/vazias/planejadas, sessão removida,2 tenants e falha do banco. Sem cache global de tenant; fonte efetiva fresca; DTO não altera plano/manifesto |
| **C2 feat(ui): compose contracted navigation and authorized dashboard** | src/components/Sidebar.tsx e dashboard: consumir a projeção; Dashboard/Configurações/Ajuda únicos; permissão operacional sempre aplicada, seleção comercial conforme tabela de estágio. Não substituir usePermission ou os componentes operacionais por outro sistema. tests/commercial-sidebar.test.ts e tests/commercial-dashboard.test.ts |14 combinações × owner/admin/user ×2 tenants; SSR e browser contra fixtures; nenhum card/link/dado indevido em modo de teste aprovado; Vendas sem Atendimento, Menu piloto sem Marketing; observe_only retém efeito comercial legado |
| **C3 feat(branding): apply validated organization identity** | src/lib/branding.ts, layout, Sidebar e src/app/(app)/settings/branding/page.tsx. Reutilizar helper e campos; logo/nome/cores/favicon da mesma organização; defaults MDS atuais preservados. Preview não pode deixar CSS global de outro tenant. tests/branding-presentation.test.ts | Dois tenants com ativos fictícios distintos,7 conjuntos × MDS/White-Label, fallback quando logo ausente, CSS/URL antigos inválidos, reload/navegação/logout, contraste e ausência de cache cruzado. Testar com ativos fornecidos, além da simples presença de logo MDS |
| **C4 feat(admin): prepare MDS authority over commercial branding** | src/lib/validations/admin.ts, src/app/api/admin/organizations/[id]/route.ts, src/app/admin/organizations/page.tsx; restringir somente campos comerciais na API/tela tenant existentes quando o modo autorizado o exigir. Compartilhar schema de branding entre APIs, sem implementar validação divergente. tests/block2-branding-authority-postgres.test.mjs | Super Admin real no handler, negativos owner/admin/user,2 tenants, campos extras/tenant no payload, PATCH parcial, auditoria/ator sem segredos, concorrência e preservação de operações legítimas. Em observe_only não revogar governança legada em massa |
| **C5 test(authz): prepare direct page and API contract coverage** | Reutilizar src/lib/authorization/{authorize,server,guards,page,policy}.ts e atualizar docs/BLOCK2_ACCESS_MATRIX.md/contrato de apresentação. Validar layouts /projects,/leads,/kanban,/atendimento e handlers correspondentes já integrados. Só alterar handler concreto se o inventário confirmar lacuna dentro do contrato; sem troca global por wildcard. tests/commercial-direct-access-postgres.test.mjs e extensão das suites de cobertura existentes | URLs/APIs diretas, cada método/mutação, owner sem módulo, sessão/tenant/papel inválidos, quotas separadas, default deny em teste enforce, observe_only sem grant nem bloqueio comercial novo. Callbacks/webhooks autenticados por provider não recebem sessão de usuário artificial |
| **C6 ci(block2): prepare sanitized-base review workflows** | Apenas os4 arquivos .github/workflows/{block2-authorization-tests,block2-postgres-concurrency,security-c03-c04,security-c03-c04-build}.yml; adicionar PR base review/block2-sanitized-base e executar novos testes nas suites adequadas. Preservar contents:read, sem deploy e sem pull_request_target | Parse YAML, filtro da base, Node22, PostgreSQL CI descartável, barreira fail/skip/TODO conforme contrato. Execução GitHub continua pendente de autorização de envio |

C1 é adaptador de apresentação, não outro authorizer: decisões de acesso a dados permanecem nos guards/servidor; DTO não concede API. Não adicionar leitura de features ao JWT como fonte permanente. Não expor permissões/contrato comercial como autoridade confiável recebida do browser. Deduplicação de leitura pode ser limitada à requisição; não usar cache compartilhado sem escopo/invalidação comprovados.

## Indicadores e recursos compartilhados

C0 deve negar dados operacionais antes da consulta mesmo em observe_only. Leads/recentes/conversão usam o contrato de Leads; Projetos e OS usam as permissões equivalentes às suas APIs; totais de membros têm regra explícita de usuário/admin. Tasks e follow-ups são servidos atualmente por /api/tasks com permissão tasks, podendo relacionar Lead ou Projeto. Não atribuir todo Task/Agenda/OS/Meta/relatório a Marketing ou Vendas porque está naquela seção do menu.

Para o estágio comercial, proposta a aprovar por recurso: Lead exige Vendas; Projeto exige Marketing; tarefa/agenda vinculada herda contexto aprovado da relação e permissão própria, sem conceder acesso a relação proibida. Registros sem vínculo ou com vínculos simultâneos precisam de regra explícita; não inventar union/intersection em silêncio. **Enquanto esse contrato não estiver aceito, nenhuma promoção comercial desses compartilhados.** O commit deve interromper sua expansão em vez de negar tudo no novo authorizer, cujos pares atuais são limitados a projects/leads/kanban/atendimento.

A UI deve distinguir métrica negada/indisponível de zero real. Não executar Promise.all com queries já iniciadas e depois esconder cards. Guard/seleção das queries vem primeiro; nenhum payload RSC pode conter registros escondidos por CSS/JavaScript.

## Marca e autoridade por campo

- Nome é hoje Organization.name e também identifica a organização: não criar brandName nem mudar uso global sem necessidade. Reutilizar o campo nos consumidores auditados; qualquer separação de nome legal/display fica fora do mínimo.
- Campos comerciais propostos: logo/favicon/cores e nome exibido no contexto de branding. O controle MDS desses campos será testado no modo aprovado, sem bloquear outras configurações operacionais do cliente.
- Plan.features já controla white_label via Super Admin. Não adicionar editor de planos paralelo, copiar features de outra organização, fazer syncFromPlan automático ou propagar a todos os tenants para mudar uma marca.
- API administrativa atual tem whitelist estrita e não aceita campos de branding; ampliar somente a whitelist/schema prevista e registrar ator/tenant. Owner/admin tenant não podem selecionar tenant alvo arbitrário nem impersonar Super Admin. Activity.userId referencia User, não SuperAdmin: para ator administrativo usar userId nulo e metadata tipada actorType/actorId com entityType=organization/entityId do tenant, escopo autorizado e sem segredos; não gravar ID de SuperAdmin na FK de User. Validar a visibilidade desse evento por tenant. O DELETE com efeitos Chatwoot/Evolution no mesmo arquivo deve permanecer byte a byte intacto.
- Preferir URLs já hospedadas/HTTPS validadas e cores hex6; não buscar URLs arbitrárias no servidor. Validar dados antigos antes de gerar CSS/HTML. Cache e favicon precisam acompanhar org/sessão; MDS sem adicional conserva sua identidade padrão atual.
- Nenhuma alteração na imagem White-Label global do Chatwoot, iframe, providers, número WhatsApp, schema, billing, preço ou domínio próprio neste lote.

## Ordem, checks e rollback

1. Aprovar C0 e seus critérios primeiro; executar alteração mínima, testes negativos virarem PASS e revisão antes de apresentação comercial.
2. Aprovar contratos compartilhados e C1–C5; implementar um objetivo por commit. Se aparecer novo arquivo de core/provider, parar o lote e apresentar impacto/rollback específico antes de ampliar escopo.
3. Após cada commit: testes afetados e lint focado sem diagnósticos novos; comparar diagnósticos globais por arquivo/regra, sem esconder falhas antigas. Antes de congelar candidata: Prisma validate, typecheck, build,102 Node/PostgreSQL e171 TS como base de regressão, além dos novos casos/HTTP/browser. Registrar contagens reais; não inventar novo total previsto.
4. Não aplicar migrate deploy/dev ou npm start/prestart. Banco apenas local/CI descartável. Não precisa migration para os campos comerciais existentes.
5. Rollback por commit pequeno e autorização, sem apagar dados/branding/features, recibos OAuth/webhook ou IDs duráveis. C0 não deve ser revertido com usuários removidos expostos; suspender acesso ao Dashboard se algum recuo for necessário. C2–C4 restauram apresentação/escrita do grupo afetado com registro, sem propagação em massa.
6. Nenhuma mudança em APPROVED_ENFORCEMENTS neste lote. A ativação exige pedido/aceite posterior com tenants/escopo/rollback explícitos. Testes em modo aprovado não autorizam ativação.

## Aprovação solicitada

A decisão do responsável deve identificar commits aprovados (recomendação: **C0 primeiro**), responsáveis de revisão, contrato dos compartilhados e se C6/preparação GitHub entra no lote. Publicação de duas novas refs e criação de PR Draft são autorização separada, descrita no plano de GitHub. Não há autorização implícita para apagar histórico remoto ou alterar produção.
