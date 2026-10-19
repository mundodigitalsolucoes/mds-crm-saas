# Bloco 2 — Auditoria focalizada de permissões e owner

**Branch:** `feature/modular-plans-entitlements`  
**Estado:** auditoria parcial de leitura; sem mudança de enforcement.

## Evidências diretas (arquivos inspecionados)

1. `src/lib/permissions.ts`: `ownerPermissions()` atribui `fullAccess()` para todos os módulos granulares. `getDefaultPermissions('owner')` e `parsePermissions` retornam/mesclam permissões por role, sem evidência de interseção com módulos contratados **neste arquivo**. Isso não prova ausência de uma camada de entitlements em outros pontos.
2. `src/types/permissions.ts`: `PermissionModule` enumera recursos granulares (`leads`, `projects`, `atendimento`, etc.), não diretamente os produtos comerciais Atendimento/Vendas/Marketing. Exige mapeamento explícito, testado e sem ambiguidades.
3. `src/lib/permissions.ts`: `ROUTE_MODULE_MAP` e `API_ROUTE_MODULE_MAP` são mapas parciais; mapear rotas não é sinônimo de verificar autorização em todas as APIs e server actions.
4. `middleware.ts`: o `matcher` cobre páginas operacionais listadas e `/api/admin/:path*`, mas **não** `/api/leads/:path*`, `/api/projects/:path*` e demais APIs operacionais de forma geral. É necessário verificar autorização interna em cada handler; não concluir exploração sem esse inventário.
5. `middleware.ts`: `planStatus === 'past_due'` causa bloqueio imediato nas rotas correspondentes, diferente da política futura de 10 dias de atraso. Não modificar a lógica comercial nesta auditoria.
6. `src/lib/auth.ts`: o JWT atualiza role, permissions e planStatus a partir do banco quando possível, mas conserva claims antigos em falhas de banco; revisar comportamento fail-closed para operações sensíveis.
7. C03/C04: CI source-level e build já aprovados em execuções anteriores. Não constituem evidência de enforcement de módulos ou de isolamento entre tenants.

## Critérios de implementação antes de ativar bloqueios

- Fonte autoritativa: resolver entitlements do tenant no servidor, separadamente das permissões por role. Regra efetiva = módulo contratado **E** ação permitida para o papel, inclusive owner.
- `observe_only` não deve ser confundido com enforcement ativo; transição exige inventário, plano de rollout e aprovação.
- Identificar exatamente quais páginas/APIs/server actions pertencem a Marketing, Atendimento e Vendas. `projects` e `reports` não podem ser atribuídos por suposição.
- Ótica São Paulo: validar bloqueio de Marketing em UI e backend, mantendo recursos autorizados; não alterar banco real ou dados do piloto.
- Proteção por tenant: todo acesso a recursos deve usar `organizationId` obtido da sessão/servidor, nunca confiar em `organizationId` enviado pelo cliente.
- Webhooks técnicos Meta/Chatwoot e callbacks de providers devem seguir autenticação própria, não autenticação humana; C01/C02 ainda exigem auditoria.
- Testar owner/admin/manager/user × módulos ativos/inativos × tenant correto/incorreto × páginas/APIs/server actions × token desatualizado × falha do banco.
- Preservar CORE protegido, isolamento de providers e não realizar merge/deploy/migração.

## Próxima ação

Inventariar camada de entitlements existente na branch, identificar pontos de consumo e matriz de mapeamento oficial; só então propor patch mínimo e testes. Não implementar bloqueio de Marketing no piloto sem evidência da configuração contratual e autorização de alteração de dados.

## Complemento: motor de autorização comercial (auditoria 2026-10-18)

A camada `src/lib/authorization/authorize.ts` ja valida usuario ativo, tenant, assinatura, modulo contratado e permissao do papel, inclusive `owner`. O resolver comercial exige features explicitas e nao concede modulos automaticamente pelo nome do plano. O helper legado `checkPermission` continua permitindo owner apos conferir o vinculo; `guards.ts` preserva essa autorizacao em `observe_only`.

O manifesto `APPROVED_ENFORCEMENTS` de `policy.ts` continua vazio. Nao existe bloqueio comercial ativo. Os testes existentes (`tests/authorization.test.ts`, `authorization-integration.test.ts`, `authorization-sales.test.ts`, `authorization-boundaries.test.ts`) cobrem casos sinteticos, inclusive negativas de owner e isolamento de recursos; nao equivalem a homologacao no WordPress ou no tenant real (o CRM e Next.js).

A matriz `docs/BLOCK2_ACCESS_MATRIX.md` documenta projetos de Marketing e leads/pipeline de Vendas em observe_only. Falta comprovar cobertura integral antes de ativar enforcement. O middleware bloqueia `past_due` imediatamente nas rotas que intercepta, ainda divergente da futura politica comercial de dez dias. Sem alteracao de providers, dados reais ou enforcement nesta etapa.
